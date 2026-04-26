import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:cryptography/cryptography.dart';
import 'package:crypto/crypto.dart' as crypto;

/// SocketService:
/// - Performs an X25519 handshake to derive an AES-GCM key
/// - Sends periodic encrypted heartbeats and expects heartbeat acks
/// - Reconnects automatically with exponential backoff + jitter
/// - Provides sendEncrypted(...) and messages stream for decrypted payloads
class SocketService {
  final Uri uri;
  final Duration heartbeatInterval;
  final Duration heartbeatTimeout;
  final Duration initialBackoff;
  final Duration maxBackoff;
  final double backoffFactor;

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _heartbeatTimer;
  Timer? _heartbeatAckTimer;
  bool _connected = false;
  bool _handshakeComplete = false;
  bool _manuallyClosed = false;
  int _reconnectAttempts = 0;

  // Crypto primitives
  final X25519 _x25519 = X25519();
  final AesGcm _aead = AesGcm.with256bits();
  KeyPair? _localKeyPair;
  SimplePublicKey? _remotePublicKey;
  SecretKey? _symmetricKey;

  final _incomingController = StreamController<Map<String, dynamic>>.broadcast();
  final List<Map<String, dynamic>> _pendingPlainQueue = [];
  Completer<void>? _handshakeCompleter;

  SocketService({
    required this.uri,
    this.heartbeatInterval = const Duration(seconds: 30),
    this.heartbeatTimeout = const Duration(seconds: 10),
    this.initialBackoff = const Duration(seconds: 1),
    this.maxBackoff = const Duration(seconds: 60),
    this.backoffFactor = 2.0,
  });

  Stream<Map<String, dynamic>> get messages => _incomingController.stream;
  bool get isConnected => _connected && _handshakeComplete;

  Future<void> connect() async {
    _manuallyClosed = false;
    await _attemptConnect();
  }

  Future<void> _attemptConnect() async {
    if (_connected) return;
    try {
      if (_channel != null) {
        await _channel!.sink.close();
      }
    } catch (_) {}
    
    try {
      _channel = WebSocketChannel.connect(uri);
      _subscription = _channel!.stream.listen(
        _onRawMessage,
        onError: _onError,
        onDone: _onDone,
        cancelOnError: true,
      );
      _connected = true;
      _reconnectAttempts = 0;
      
      await _performHandshake();
      _startHeartbeat();
      await _flushPendingQueue();
    } catch (_) {
      _connected = false;
      _handshakeComplete = false;
      await _subscription?.cancel();
      try {
        await _channel?.sink.close();
      } catch (_) {}
      _channel = null;
      _startReconnect();
      rethrow;
    }
  }

  Future<void> _performHandshake() async {
    _handshakeComplete = false;
    _handshakeCompleter = Completer<void>();
    _localKeyPair = await _x25519.newKeyPair();
    final localPub = await _localKeyPair!.extractPublicKey();
    final payload = jsonEncode({
      'type': 'handshake',
      'publicKey': base64.encode(localPub.bytes),
      'alg': 'X25519'
    });
    _channel!.sink.add(payload);
    try {
      await _handshakeCompleter!.future.timeout(const Duration(seconds: 10));
    } catch (e) {
      _handshakeCompleter = null;
      throw Exception('Handshake timed out or failed');
    }
  }

  void _onRawMessage(dynamic raw) async {
    try {
      final msgStr = raw is String ? raw : utf8.decode(raw as List<int>);
      final msg = jsonDecode(msgStr) as Map<String, dynamic>;
      final type = msg['type'];
      
      if (type == 'handshake') {
        await _handleHandshake(msg);
        return;
      }
      if (type == 'heartbeat_ack') {
        _onHeartbeatAck();
        return;
      }
      if (type == 'enc') {
        await _handleEncrypted(msg);
        return;
      }
      _incomingController.add(msg);
    } catch (e) {
      // malformed/unhandled message
    }
  }

  Future<void> _handleHandshake(Map<String, dynamic> msg) async {
    final serverPkB64 = msg['publicKey'] as String?;
    if (serverPkB64 == null) return;
    final serverPkBytes = base64.decode(serverPkB64);
    _remotePublicKey = SimplePublicKey(serverPkBytes, type: KeyPairType.x25519);
    final sharedSecret = await _x25519.sharedSecretKey(
      keyPair: _localKeyPair!,
      remotePublicKey: _remotePublicKey!,
    );
    final sharedBytes = await sharedSecret.extractBytes();
    final info = utf8.encode('SocketService v1');
    final derived = crypto.sha256.convert(<int>[]..addAll(sharedBytes)..addAll(info)).bytes;
    _symmetricKey = SecretKey(derived);
    _handshakeComplete = true;
    _handshakeCompleter?.complete();
    _handshakeCompleter = null;
  }

  Future<void> _handleEncrypted(Map<String, dynamic> msg) async {
    if (_symmetricKey == null) return;
    try {
      final nonce = base64.decode(msg['nonce'] as String);
      final ciphertext = base64.decode(msg['ciphertext'] as String);
      final macBytes = base64.decode(msg['mac'] as String);
      final secretBox = SecretBox(ciphertext, nonce: nonce, mac: Mac(macBytes));
      final clear = await _aead.decrypt(secretBox, secretKey: _symmetricKey!);
      final payload = jsonDecode(utf8.decode(clear)) as Map<String, dynamic>;
      if (payload['type'] == 'heartbeat_ack') {
        _onHeartbeatAck();
      } else {
        _incomingController.add(payload);
      }
    } catch (e) {
      // decryption failed
    }
  }

  Future<void> sendEncrypted(Map<String, dynamic> payload) async {
    if (!_handshakeComplete || _channel == null) {
      _pendingPlainQueue.add(payload);
      return;
    }
    final encrypted = await _encryptPayload(payload);
    _channel!.sink.add(encrypted);
  }

  Future<String> _encryptPayload(Map<String, dynamic> payload) async {
    final jsonBytes = utf8.encode(jsonEncode(payload));
    final nonce = _randomBytes(12);
    final secretBox = await _aead.encrypt(jsonBytes, secretKey: _symmetricKey!, nonce: nonce);
    final packet = {
      'type': 'enc',
      'nonce': base64.encode(secretBox.nonce),
      'ciphertext': base64.encode(secretBox.cipherText),
      'mac': base64.encode(secretBox.mac.bytes),
    };
    return jsonEncode(packet);
  }

  List<int> _randomBytes(int length) {
    final r = Random.secure();
    return List<int>.generate(length, (_) => r.nextInt(256));
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(heartbeatInterval, (_) => _sendHeartbeat());
  }

  void _sendHeartbeat() {
    if (!_handshakeComplete || _channel == null) return;
    final payload = {'type': 'heartbeat', 'ts': DateTime.now().toUtc().toIso8601String()};
    sendEncrypted(payload);
    _heartbeatAckTimer?.cancel();
    _heartbeatAckTimer = Timer(heartbeatTimeout, () {
      _onHeartbeatTimeout();
    });
  }

  void _onHeartbeatAck() {
    _heartbeatAckTimer?.cancel();
  }

  void _onHeartbeatTimeout() {
    _connected = false;
    _handshakeComplete = false;
    try {
      _subscription?.cancel();
    } catch (_) {}
    try {
      _channel?.sink.close();
    } catch (_) {}
    _channel = null;
    _startReconnect();
  }

  Future<void> _flushPendingQueue() async {
    if (!_handshakeComplete || _channel == null) return;
    final queued = List<Map<String, dynamic>>.from(_pendingPlainQueue);
    _pendingPlainQueue.clear();
    for (final p in queued) {
      final enc = await _encryptPayload(p);
      _channel!.sink.add(enc);
    }
  }

  void _onDone() {
    _connected = false;
    _handshakeComplete = false;
    _startReconnect();
  }

  void _onError(Object error) {
    _connected = false;
    _handshakeComplete = false;
    _startReconnect();
  }

  void _startReconnect() {
    if (_manuallyClosed) return;
    _reconnectAttempts++;
    final delay = _computeBackoff();
    Timer(delay, () async {
      if (_manuallyClosed) return;
      try {
        await _attemptConnect();
      } catch (_) {
        _startReconnect();
      }
    });
  }

  Duration _computeBackoff() {
    final baseMs = initialBackoff.inMilliseconds * pow(backoffFactor, _reconnectAttempts);
    final capped = min(maxBackoff.inMilliseconds.toDouble(), baseMs.toDouble()).toInt();
    final jitter = capped > 1 ? Random().nextInt((capped * 0.5).toInt() + 1) : 0;
    return Duration(milliseconds: capped + jitter);
  }

  Future<void> close() async {
    _manuallyClosed = true;
    _heartbeatTimer?.cancel();
    _heartbeatAckTimer?.cancel();
    await _subscription?.cancel();
    try {
      if (_channel != null) {
        await _channel!.sink.close();
      }
    } catch (_) {}
    _channel = null;
    _connected = false;
    _handshakeComplete = false;
    await _incomingController.close();
  }
}
