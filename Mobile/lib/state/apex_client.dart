import 'dart:async';

import 'package:flutter/foundation.dart';

import '../services/intent_mapper.dart';
import '../services/socket_service.dart';

class ApexLogEntry {
  final DateTime ts;
  final String label;
  final String message;

  ApexLogEntry({required this.ts, required this.label, required this.message});
}

class ApexClient extends ChangeNotifier {
  Uri _serverUri = Uri.parse('ws://10.0.2.2:8787/ws');
  SocketService? _socket;
  StreamSubscription? _sub;

  bool _connecting = false;
  String? _lastError;

  final IntentMapper _intentMapper = IntentMapper();
  final List<ApexLogEntry> _logs = [];
  final List<Map<String, dynamic>> _messages = [];

  Uri get serverUri => _serverUri;
  bool get isConnecting => _connecting;
  bool get isConnected => _socket?.isConnected ?? false;
  String? get lastError => _lastError;
  List<ApexLogEntry> get logs => List.unmodifiable(_logs);
  List<Map<String, dynamic>> get messages => List.unmodifiable(_messages);

  void setServerUri(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return;
    final next = Uri.tryParse(trimmed);
    if (next == null) return;
    _serverUri = next;
    _log('config', 'Set server to $trimmed');
    notifyListeners();
  }

  Future<void> connect() async {
    if (_connecting || isConnected) return;
    _connecting = true;
    _lastError = null;
    notifyListeners();

    _socket = SocketService(uri: _serverUri);
    _sub?.cancel();
    _sub = _socket!.messages.listen((msg) {
      _messages.insert(0, msg);
      _log('rx', msg.toString());
      notifyListeners();
    });

    try {
      _log('socket', 'Connecting…');
      await _socket!.connect();
      _log('socket', 'Connected');
    } catch (e) {
      _lastError = e.toString();
      _log('error', _lastError!);
      await disconnect();
    } finally {
      _connecting = false;
      notifyListeners();
    }
  }

  Future<void> disconnect() async {
    _connecting = false;
    _sub?.cancel();
    _sub = null;
    final socket = _socket;
    _socket = null;
    if (socket != null) {
      await socket.close();
    }
    _log('socket', 'Disconnected');
    notifyListeners();
  }

  Future<void> sendNaturalLanguage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    final mapped = _intentMapper.parse(trimmed);
    _log('intent', mapped.toString());
    notifyListeners();

    if (!isConnected) {
      _lastError = 'Not connected';
      _log('error', _lastError!);
      notifyListeners();
      return;
    }

    try {
      await _socket!.sendEncrypted({
        'type': 'command',
        'ts': DateTime.now().toUtc().toIso8601String(),
        'text': trimmed,
        'intent': mapped['command'].toString(),
        'params': mapped['params'],
      });
      _log('tx', trimmed);
      _lastError = null;
    } catch (e) {
      _lastError = e.toString();
      _log('error', _lastError!);
    }

    notifyListeners();
  }

  void clearActivity() {
    _logs.clear();
    _messages.clear();
    _lastError = null;
    notifyListeners();
  }

  void _log(String label, String message) {
    _logs.insert(
      0,
      ApexLogEntry(ts: DateTime.now(), label: label, message: message),
    );
    if (_logs.length > 200) {
      _logs.removeRange(200, _logs.length);
    }
  }

  @override
  void dispose() {
    disconnect();
    super.dispose();
  }
}
