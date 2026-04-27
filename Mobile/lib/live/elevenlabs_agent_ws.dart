import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:web_socket_channel/web_socket_channel.dart';

sealed class ElevenLabsAgentEvent {}

class ElevenLabsConversationMetadataEvent extends ElevenLabsAgentEvent {
  final String agentOutputAudioFormat;
  final String userInputAudioFormat;
  ElevenLabsConversationMetadataEvent({
    required this.agentOutputAudioFormat,
    required this.userInputAudioFormat,
  });
}

class ElevenLabsUserTranscriptEvent extends ElevenLabsAgentEvent {
  final String text;
  ElevenLabsUserTranscriptEvent(this.text);
}

class ElevenLabsAgentResponseEvent extends ElevenLabsAgentEvent {
  final String text;
  ElevenLabsAgentResponseEvent(this.text);
}

class ElevenLabsAudioEvent extends ElevenLabsAgentEvent {
  final String audioBase64;
  ElevenLabsAudioEvent(this.audioBase64);
}

class ElevenLabsErrorEvent extends ElevenLabsAgentEvent {
  final String message;
  ElevenLabsErrorEvent(this.message);
}

class ElevenLabsAgentWebSocket {
  WebSocketChannel? _channel;
  StreamSubscription? _sub;
  Timer? _pingTimer;

  final _events = StreamController<ElevenLabsAgentEvent>.broadcast();
  Stream<ElevenLabsAgentEvent> get events => _events.stream;

  Future<void> connect(Uri uri) async {
    developer.log('[WS] connect($uri)');
    await disconnect();

    try {
      _channel = WebSocketChannel.connect(uri);
      developer.log('[WS] channel connected, listening...');
      _sub = _channel!.stream.listen(
        _onRaw,
        onError: (e) {
          developer.log('[WS] stream error: $e');
          _events.add(ElevenLabsErrorEvent(e.toString()));
        },
        onDone: () {
          developer.log('[WS] stream closed (onDone)');
          _events.add(ElevenLabsErrorEvent('Disconnected'));
          // Forcing a visible crash if it closes during connect
        },
        cancelOnError: true,
      );
    } catch (e, stack) {
      developer.log('[WS] connect exception: $e', stackTrace: stack);
      _events.add(ElevenLabsErrorEvent(e.toString()));
    }
  }

  Future<void> sendConversationInitiation({
    String? prompt,
    String? firstMessage,
  }) async {
    final agentConfig = <String, dynamic>{};
    if (prompt != null && prompt.trim().isNotEmpty) {
      agentConfig['prompt'] = {'prompt': prompt.trim()};
    }
    if (firstMessage != null && firstMessage.trim().isNotEmpty) {
      agentConfig['first_message'] = firstMessage.trim();
    }

    developer.log('[WS] sending initiation data');
    _sendJson({
      'type': 'conversation_initiation_client_data',
      'conversation_config': {'agent': agentConfig},
    });
  }

  Future<void> sendUserAudioChunk(String base64Audio) async {
    _sendJson({'user_audio_chunk': base64Audio});
  }

  Future<void> sendUserMessage(String text) async {
    _sendJson({'type': 'user_message', 'text': text});
  }

  Future<void> sendUserActivity() async {
    _sendJson(const {'type': 'user_activity'});
  }

  void _onRaw(dynamic raw) {
    try {
      final msgStr = raw is String ? raw : utf8.decode(raw as List<int>);
      developer.log('[WS] raw message: $msgStr');
      final msg = jsonDecode(msgStr) as Map<String, dynamic>;
      final type = msg['type']?.toString();

      if (type == 'internal_error' || type == 'error') {
        developer.log('[WS] Server Error Message: $msgStr');
        final errorMsg =
            msg['message']?.toString() ?? msg['error']?.toString() ?? msgStr;
        _events.add(ElevenLabsErrorEvent(errorMsg));
        return;
      }

      if (type == 'ping') {
        _handlePing(msg);
        return;
      }

      if (type == 'conversation_initiation_metadata') {
        final event =
            msg['conversation_initiation_metadata_event']
                as Map<String, dynamic>?;
        if (event == null) return;
        developer.log('[WS] metadata received');
        _events.add(
          ElevenLabsConversationMetadataEvent(
            agentOutputAudioFormat: (event['agent_output_audio_format'] ?? '')
                .toString(),
            userInputAudioFormat:
                (event['userInputAudioFormat'] ??
                        (event['user_input_audio_format'] ?? ''))
                    .toString(),
          ),
        );
        return;
      }

      if (type == 'user_transcript') {
        final text = (msg['user_transcription_event']?['user_transcript'] ?? '')
            .toString();
        if (text.isNotEmpty) _events.add(ElevenLabsUserTranscriptEvent(text));
        return;
      }

      if (type == 'agent_response') {
        final text = (msg['agent_response_event']?['agent_response'] ?? '')
            .toString();
        if (text.isNotEmpty) _events.add(ElevenLabsAgentResponseEvent(text));
        return;
      }

      if (type == 'audio') {
        final audio = (msg['audio_event']?['audio_base_64'] ?? '').toString();
        if (audio.isNotEmpty) _events.add(ElevenLabsAudioEvent(audio));
        return;
      }
    } catch (e) {
      developer.log('[WS] _onRaw exception: $e');
    }
  }

  void _handlePing(Map<String, dynamic> msg) {
    try {
      final pingEvent = msg['ping_event'] as Map<String, dynamic>?;
      if (pingEvent == null) return;
      final eventId = pingEvent['event_id'];
      final pingMs = int.tryParse(pingEvent['ping_ms'].toString()) ?? 0;

      _pingTimer?.cancel();
      _pingTimer = Timer(Duration(milliseconds: pingMs), () {
        _sendJson({'type': 'pong', 'event_id': eventId});
      });
    } catch (_) {}
  }

  void _sendJson(Map<String, dynamic> payload) {
    final channel = _channel;
    if (channel == null) {
      developer.log('[WS] cannot send JSON, channel is null');
      return;
    }
    channel.sink.add(jsonEncode(payload));
  }

  Future<void> disconnect() async {
    developer.log('[WS] disconnect()');
    _pingTimer?.cancel();
    _pingTimer = null;
    await _sub?.cancel();
    _sub = null;
    try {
      await _channel?.sink.close();
    } catch (_) {}
    _channel = null;
  }

  void dispose() {
    disconnect();
    _events.close();
  }
}
