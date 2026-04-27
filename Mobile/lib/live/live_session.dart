import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:collection';
import 'dart:developer' as developer;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:record/record.dart';

import '../audio/pcm16_player.dart';
import '../platform/call_mode.dart';
import 'elevenlabs_agent_ws.dart';

enum LiveConnectionState { idle, connecting, connected, error }

enum VadState { silence, speech }

class LiveTurn {
  final bool fromUser;
  final String text;
  final DateTime ts;

  LiveTurn({required this.fromUser, required this.text, required this.ts});
}

class LiveSession extends ChangeNotifier {
  final ElevenLabsAgentWebSocket _agent = ElevenLabsAgentWebSocket();
  final AudioRecorder _recorder = AudioRecorder();
  final Pcm16Player _player = Pcm16Player();

  LiveConnectionState _state = LiveConnectionState.idle;
  String? _lastError;
  bool _micOn = false;
  bool _wantMicOn = false;
  bool _speakerOn = false;
  bool _maintainConnection = false;
  DateTime? _callConnectedAt;
  Timer? _callTimer;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;

  String _agentId;
  String _signedUrl;
  String _apiKey;
  int _inputSampleRate = 16000;
  int _outputSampleRate = 16000;

  double _inputLevel = 0;
  double _agentLevel = 0;

  bool _autoVad = true;
  double _vadSensitivity = 1.35;
  VadState _vadState = VadState.silence;
  double _noiseFloor = 0.02;
  double _speechThreshold = 0.04;
  double _silenceThreshold = 0.028;
  double _speechMs = 0;
  double _silenceMs = 0;
  final ListQueue<Uint8List> _preRoll = ListQueue<Uint8List>();
  double _preRollMs = 0;

  final List<LiveTurn> _turns = [];
  StreamSubscription? _agentSub;
  StreamSubscription<Uint8List>? _micSub;
  Timer? _levelDecayTimer;

  LiveSession({String agentId = '', String signedUrl = '', String apiKey = ''})
    : _agentId = agentId.trim(),
      _signedUrl = signedUrl.trim(),
      _apiKey = apiKey.trim();

  LiveConnectionState get state => _state;
  String? get lastError => _lastError;
  bool get micOn => _micOn;
  bool get speakerOn => _speakerOn;
  DateTime? get callConnectedAt => _callConnectedAt;
  bool get callActive =>
      _callConnectedAt != null && _state == LiveConnectionState.connected;
  Duration get callDuration => _callConnectedAt == null
      ? Duration.zero
      : DateTime.now().difference(_callConnectedAt!);
  String get agentId => _agentId;
  String get signedUrl => _signedUrl;
  String get apiKey => _apiKey;
  double get inputLevel => _inputLevel;
  double get agentLevel => _agentLevel;
  bool get autoVad => _autoVad;
  double get vadSensitivity => _vadSensitivity;
  VadState get vadState => _vadState;
  bool get speechActive => _vadState == VadState.speech;
  double get vadNoiseFloor => _noiseFloor;
  double get vadSpeechThreshold => _speechThreshold;
  double get vadSilenceThreshold => _silenceThreshold;
  List<LiveTurn> get turns => List.unmodifiable(_turns);

  void setAgentId(String value) {
    _agentId = value.trim();
    notifyListeners();
  }

  void setSignedUrl(String value) {
    _signedUrl = value.trim();
    notifyListeners();
  }

  void setApiKey(String value) {
    _apiKey = value.trim();
    notifyListeners();
  }

  void setAutoVad(bool value) {
    _autoVad = value;
    notifyListeners();
  }

  void setVadSensitivity(double value) {
    _vadSensitivity = value.clamp(1.05, 2.2);
    notifyListeners();
  }

  Future<void> connect({bool forceRefreshSignedUrl = false}) async {
    developer.log('[LiveSession] connect() called');
    if (_state == LiveConnectionState.connecting ||
        _state == LiveConnectionState.connected) {
      developer.log(
        '[LiveSession] already connecting/connected (state=$_state)',
      );
      return;
    }

    final resolvedUrl = await _resolveWsUrl(
      forceRefreshSignedUrl: forceRefreshSignedUrl,
    );
    if (resolvedUrl == null) {
      developer.log('[LiveSession] failed to resolve WS URL');
      _setError('Enter an agent id or signed url.');
      return;
    }

    developer.log('[LiveSession] Setting state to connecting...');
    _state = LiveConnectionState.connecting;
    _lastError = null;
    notifyListeners();

    try {
      developer.log('[LiveSession] Enabling CallMode...');
      await CallMode.enable();
      developer.log('[LiveSession] Connecting to agent WS: $resolvedUrl');

      final metadataCompleter = Completer<void>();
      _agentSub?.cancel();
      _agentSub = _agent.events.listen((event) {
        if (event is ElevenLabsConversationMetadataEvent) {
          if (!metadataCompleter.isCompleted) metadataCompleter.complete();
        }
        _onAgentEvent(event);
      });

      await _agent.connect(resolvedUrl);

      developer.log('[LiveSession] Waiting for metadata...');
      // Wait for metadata with a timeout
      await metadataCompleter.future.timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          developer.log('[LiveSession] Timed out waiting for metadata');
          throw Exception(
            'ElevenLabs Timeout: Metadata never received. Check agent ID and API key.',
          );
        },
      );

      developer.log('[LiveSession] Sending conversation initiation...');
      await _agent.sendConversationInitiation(
        prompt: _playfulPrompt,
        firstMessage: _playfulFirstMessage,
      );
      developer.log('[LiveSession] Initializing player...');
      await _player.init(sampleRate: _outputSampleRate, channels: 1);
      await _player.start();

      _state = LiveConnectionState.connected;
      developer.log('[LiveSession] Connected successfully');
      _reconnectAttempts = 0;
      _reconnectTimer?.cancel();
      _reconnectTimer = null;
      _callConnectedAt = DateTime.now();
      _callTimer?.cancel();
      _callTimer = Timer.periodic(
        const Duration(seconds: 1),
        (_) => notifyListeners(),
      );
      _lastError = null;
      _startLevelDecay();
      if (_wantMicOn && !_micOn) {
        developer.log('[LiveSession] starting mic as intended');
        await startMic();
      }
    } catch (e, stack) {
      developer.log('[LiveSession] CONNECTION EXCEPTION: $e', stackTrace: stack);
      _setError(e.toString());
      await _teardownTransport(preserveMicIntent: true, disableCallMode: false);
      if (_maintainConnection) {
        _scheduleReconnect();
      } else {
        await disconnect();
      }
    } finally {
      notifyListeners();
    }
  }

  String get _playfulPrompt {
    return '''
You are APEX, a playful but highly capable companion helping the user build and operate their APEX system.
Style:
- Be concise and actionable.
- Light, friendly, a little witty (no cringe).
- Ask short clarifying questions when needed.
- Prefer step-by-step guidance and quick confirmations.
''';
  }

  String get _playfulFirstMessage {
    return "Hey—APEX here. Want to build, debug, or deploy something?";
  }

  Future<void> disconnect() async {
    developer.log('[LiveSession] disconnect()');
    await _teardownTransport(preserveMicIntent: false, disableCallMode: true);
    _callTimer?.cancel();
    _callTimer = null;
    _callConnectedAt = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _reconnectAttempts = 0;
    _maintainConnection = false;
    _state = LiveConnectionState.idle;
    notifyListeners();
  }

  Future<void> startCall() async {
    developer.log('[LiveSession] startCall()');
    _maintainConnection = true;
    _wantMicOn = true;
    await connect(forceRefreshSignedUrl: false);
    if (_state != LiveConnectionState.connected) return;
    await startMic();
  }

  Future<void> endCall() async {
    developer.log('[LiveSession] endCall()');
    _maintainConnection = false;
    _wantMicOn = false;
    _speakerOn = false;
    await disconnect();
  }

  Future<void> toggleSpeaker() async {
    _speakerOn = !_speakerOn;
    developer.log('[LiveSession] toggleSpeaker: $_speakerOn');
    await CallMode.setSpeakerphoneOn(_speakerOn);
    notifyListeners();
  }

  Future<void> toggleMic() async {
    if (_micOn) {
      await stopMic();
    } else {
      await startMic();
    }
  }

  Future<void> startMic() async {
    developer.log('[LiveSession] startMic()');
    _wantMicOn = true;
    if (_state != LiveConnectionState.connected) {
      await connect();
      if (_state != LiveConnectionState.connected) return;
    }

    final hasPerm = await _recorder.hasPermission();
    if (!hasPerm) {
      developer.log('[LiveSession] mic permission denied');
      _setError('Microphone permission denied.');
      return;
    }

    if (_micOn) return;
    _micOn = true;
    _lastError = null;
    _vadState = VadState.silence;
    _speechMs = 0;
    _silenceMs = 0;
    _noiseFloor = 0.02;
    _preRoll.clear();
    _preRollMs = 0;
    notifyListeners();

    final stream = await _recorder.startStream(
      RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        sampleRate: _inputSampleRate,
        numChannels: 1,
        bitRate: 256000,
      ),
    );

    _micSub?.cancel();
    _micSub = stream.listen(
      (chunk) async {
        final rms = _pcm16Rms(chunk);
        _inputLevel = _smooth(_inputLevel, rms, 0.25);
        _updateVad(chunk, rms);
        notifyListeners();

        if (!_autoVad || _vadState == VadState.speech) {
          final b64 = base64.encode(chunk);
          await _agent.sendUserAudioChunk(b64);
        }
      },
      onError: (e) {
        developer.log('[LiveSession] mic stream error: $e');
        _setError(e.toString());
        stopMic();
      },
      onDone: () {
        developer.log('[LiveSession] mic stream done');
        _micOn = false;
        notifyListeners();
      },
      cancelOnError: true,
    );
  }

  Future<void> stopMic() async {
    developer.log('[LiveSession] stopMic()');
    _wantMicOn = false;
    await _stopMicInternal();
  }

  Future<void> _stopMicInternal({bool preserveIntent = false}) async {
    if (!preserveIntent) {
      _wantMicOn = false;
    }
    if (!_micOn) return;
    _micOn = false;
    await _micSub?.cancel();
    _micSub = null;
    try {
      await _recorder.stop();
    } catch (_) {}
    notifyListeners();
  }

  void _updateVad(Uint8List chunk, double rms) {
    final chunkMs = _chunkDurationMs(chunk.lengthInBytes, _inputSampleRate);

    _preRoll.add(chunk);
    _preRollMs += chunkMs;
    while (_preRollMs > 320 && _preRoll.isNotEmpty) {
      final removed = _preRoll.removeFirst();
      _preRollMs -= _chunkDurationMs(removed.lengthInBytes, _inputSampleRate);
    }

    if (!_autoVad) return;

    final provisionalSpeech = max(0.04, _noiseFloor * _vadSensitivity);
    if (rms <= provisionalSpeech) {
      _noiseFloor = _smooth(_noiseFloor, rms, 0.08).clamp(0.005, 0.20);
    } else if (_vadState == VadState.silence) {
      _noiseFloor = _smooth(_noiseFloor, rms, 0.02).clamp(0.005, 0.20);
    }

    _speechThreshold = max(0.04, _noiseFloor * _vadSensitivity);
    _silenceThreshold = max(0.028, _noiseFloor * _vadSensitivity * 0.80);

    final isSpeech = rms >= _speechThreshold;
    final isSilence = rms <= _silenceThreshold;

    if (_vadState == VadState.silence) {
      _silenceMs = 0;
      _speechMs = isSpeech ? (_speechMs + chunkMs) : 0;
      if (_speechMs >= 120) {
        _vadState = VadState.speech;
        _speechMs = 0;
        _silenceMs = 0;
        unawaited(_agent.sendUserActivity());
        unawaited(_flushPreRoll());
      }
      return;
    }

    _speechMs = 0;
    _silenceMs = isSilence ? (_silenceMs + chunkMs) : 0;
    if (_silenceMs >= 700) {
      _vadState = VadState.silence;
      _silenceMs = 0;
      _speechMs = 0;
      _preRoll.clear();
      _preRollMs = 0;
    }
  }

  Future<void> _flushPreRoll() async {
    if (_state != LiveConnectionState.connected) return;
    while (_preRoll.isNotEmpty) {
      final bytes = _preRoll.removeFirst();
      final b64 = base64.encode(bytes);
      await _agent.sendUserAudioChunk(b64);
    }
    _preRollMs = 0;
  }

  double _chunkDurationMs(int byteLength, int sampleRate) {
    if (byteLength < 2 || sampleRate <= 0) return 0;
    final samples = byteLength / 2;
    return (samples / sampleRate) * 1000.0;
  }

  Future<void> sendText(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    if (_state != LiveConnectionState.connected) {
      await connect();
      if (_state != LiveConnectionState.connected) return;
    }

    _turns.insert(
      0,
      LiveTurn(fromUser: true, text: trimmed, ts: DateTime.now()),
    );
    notifyListeners();

    try {
      await _agent.sendUserMessage(trimmed);
    } catch (e) {
      _setError(e.toString());
    }
  }

  void clear() {
    _turns.clear();
    _lastError = null;
    _inputLevel = 0;
    _agentLevel = 0;
    _vadState = VadState.silence;
    notifyListeners();
  }

  Future<Uri?> _resolveWsUrl({required bool forceRefreshSignedUrl}) async {
    developer.log(
      '[LiveSession] _resolveWsUrl(forceRefresh=$forceRefreshSignedUrl)',
    );
    if (_signedUrl.isNotEmpty && !forceRefreshSignedUrl) {
      developer.log('[LiveSession] using existing signedUrl');
      return Uri.tryParse(_signedUrl);
    }
    if (_agentId.isNotEmpty) {
      if (_apiKey.isNotEmpty) {
        developer.log('[LiveSession] fetching signed URL for agent=$_agentId');
        final signed = await _fetchSignedUrl(
          agentId: _agentId,
          apiKey: _apiKey,
        );
        if (signed != null) {
          _signedUrl = signed;
          developer.log('[LiveSession] fetched signed URL successfully');
          return Uri.tryParse(_signedUrl);
        }
      }
      developer.log('[LiveSession] using public agent URL');
      return Uri.parse(
        'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=$_agentId',
      );
    }
    developer.log('[LiveSession] no URL info available');
    return null;
  }

  Future<String?> _fetchSignedUrl({
    required String agentId,
    required String apiKey,
  }) async {
    try {
      final uri = Uri.parse(
        'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=$agentId',
      );
      final resp = await http.get(uri, headers: {'xi-api-key': apiKey});
      if (resp.statusCode < 200 || resp.statusCode >= 300) {
        developer.log(
          '[LiveSession] signed URL request failed code=${resp.statusCode} body=${resp.body}',
        );
        _setError('Signed URL request failed (${resp.statusCode}).');
        return null;
      }
      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      final signed = (data['signed_url'] ?? '').toString();
      if (signed.isEmpty) {
        _setError('Signed URL response missing `signed_url`.');
        return null;
      }
      return signed;
    } catch (e) {
      developer.log('[LiveSession] _fetchSignedUrl exception: $e');
      _setError('Signed URL error: $e');
      return null;
    }
  }

  void _onAgentEvent(ElevenLabsAgentEvent event) {
    developer.log('[LiveSession] onAgentEvent: ${event.runtimeType}');
    switch (event) {
      case ElevenLabsConversationMetadataEvent():
        developer.log(
          '[LiveSession] Metadata inSR=${event.userInputAudioFormat} outSR=${event.agentOutputAudioFormat}',
        );
        _inputSampleRate =
            _sampleRateFromFormat(event.userInputAudioFormat) ??
            _inputSampleRate;
        final nextOut = _sampleRateFromFormat(event.agentOutputAudioFormat);
        if (nextOut != null && nextOut != _outputSampleRate) {
          _outputSampleRate = nextOut;
          unawaited(() async {
            await _player.dispose();
            await _player.init(sampleRate: _outputSampleRate, channels: 1);
            await _player.start();
          }());
        }
        notifyListeners();
      case ElevenLabsUserTranscriptEvent():
        _turns.insert(
          0,
          LiveTurn(fromUser: true, text: event.text, ts: DateTime.now()),
        );
        notifyListeners();
      case ElevenLabsAgentResponseEvent():
        _turns.insert(
          0,
          LiveTurn(fromUser: false, text: event.text, ts: DateTime.now()),
        );
        notifyListeners();
      case ElevenLabsAudioEvent():
        _agentLevel = _smooth(_agentLevel, max(_agentLevel, 0.6), 0.4);
        unawaited(_player.write(base64.decode(event.audioBase64)));
        notifyListeners();
      case ElevenLabsErrorEvent():
        developer.log('[LiveSession] Agent Error: ${event.message}');
        _setError(event.message);
        if (_maintainConnection) {
          unawaited(
            _teardownTransport(preserveMicIntent: true, disableCallMode: false),
          );
          _scheduleReconnect();
        }
    }
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectAttempts++;
    final delayMs = min(12000, 800 * (1 << min(6, _reconnectAttempts - 1)));
    developer.log('[LiveSession] scheduling reconnect in ${delayMs}ms');
    _state = LiveConnectionState.connecting;
    _lastError = 'Reconnecting…';
    notifyListeners();
    _reconnectTimer = Timer(Duration(milliseconds: delayMs), () async {
      if (!_maintainConnection) return;
      await connect(forceRefreshSignedUrl: true);
    });
  }

  Future<void> _teardownTransport({
    required bool preserveMicIntent,
    required bool disableCallMode,
  }) async {
    developer.log(
      '[LiveSession] _teardownTransport(preserveMic=$preserveMicIntent, disableCallMode=$disableCallMode)',
    );
    await _stopMicInternal(preserveIntent: preserveMicIntent);
    _agentSub?.cancel();
    _agentSub = null;
    await _player.stop();
    await _agent.disconnect();
    _callTimer?.cancel();
    _callTimer = null;
    _callConnectedAt = null;
    if (disableCallMode) {
      try {
        await CallMode.disable();
      } catch (_) {}
    }
  }

  int? _sampleRateFromFormat(String format) {
    final parts = format.split('_');
    if (parts.length < 2) return null;
    final sr = int.tryParse(parts.last);
    return sr;
  }

  void _setError(String message) {
    _lastError = message;
    _state = LiveConnectionState.error;
    notifyListeners();
  }

  void _startLevelDecay() {
    _levelDecayTimer?.cancel();
    _levelDecayTimer = Timer.periodic(const Duration(milliseconds: 40), (_) {
      final nextIn = _inputLevel * 0.92;
      final nextOut = _agentLevel * 0.92;
      final changed =
          (nextIn - _inputLevel).abs() > 0.001 ||
          (nextOut - _agentLevel).abs() > 0.001;
      _inputLevel = nextIn;
      _agentLevel = nextOut;
      if (changed) notifyListeners();
    });
  }

  double _pcm16Rms(Uint8List data) {
    if (data.length < 2) return 0;
    final bd = ByteData.sublistView(data);
    var sum = 0.0;
    final sampleCount = data.length ~/ 2;
    for (var i = 0; i < sampleCount; i++) {
      final s = bd.getInt16(i * 2, Endian.little) / 32768.0;
      sum += s * s;
    }
    final rms = sqrt(sum / sampleCount);
    return rms.clamp(0.0, 1.0);
  }

  double _smooth(double current, double next, double factor) {
    return current + (next - current) * factor;
  }

  @override
  void dispose() {
    _levelDecayTimer?.cancel();
    _callTimer?.cancel();
    _agentSub?.cancel();
    _micSub?.cancel();
    _player.dispose();
    _agent.dispose();
    _recorder.dispose();
    super.dispose();
  }
}
