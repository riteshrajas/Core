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

class ApexApprovalRequest {
  final String id;
  final String title;
  final String command;
  final String risk;
  final String path;

  const ApexApprovalRequest({
    required this.id,
    required this.title,
    required this.command,
    required this.risk,
    required this.path,
  });
}

class ApexTaskStatus {
  final String id;
  final String title;
  final String status;
  final double progress;

  const ApexTaskStatus({
    required this.id,
    required this.title,
    required this.status,
    required this.progress,
  });
}

class ApexClient extends ChangeNotifier {
  Uri _serverUri;
  SocketService? _socket;
  StreamSubscription? _sub;

  bool _connecting = false;
  String? _lastError;

  final IntentMapper _intentMapper = IntentMapper();
  final List<ApexLogEntry> _logs = [];
  final List<Map<String, dynamic>> _messages = [];
  final List<ApexApprovalRequest> _approvals = [];
  final List<ApexTaskStatus> _tasks = [];

  Uri get serverUri => _serverUri;
  bool get isConnecting => _connecting;
  bool get isConnected => _socket?.isConnected ?? false;
  String? get lastError => _lastError;
  List<ApexLogEntry> get logs => List.unmodifiable(_logs);
  List<Map<String, dynamic>> get messages => List.unmodifiable(_messages);
  List<ApexApprovalRequest> get approvals => List.unmodifiable(_approvals);
  List<ApexTaskStatus> get tasks => List.unmodifiable(_tasks);

  ApexClient({String initialServerUri = 'ws://10.0.2.2:8787/ws'})
    : _serverUri = Uri.parse(initialServerUri);

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
      _ingestCloudMessage(msg);
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

  Future<void> requestHostStatus() async {
    await sendCloudUtility(
      utility: 'host_status',
      action: 'snapshot',
      label: 'Request host status',
    );
  }

  Future<void> requestAwaySummary() async {
    await sendCloudUtility(
      utility: 'away_summary',
      action: 'summarize',
      label: 'Request away summary',
    );
  }

  Future<void> runCommandPreset(String label, String command) async {
    await sendCloudUtility(
      utility: 'command',
      action: 'run',
      label: label,
      payload: {'command': command},
    );
  }

  Future<void> sendAgentControl(String action) async {
    await sendCloudUtility(
      utility: 'agent_control',
      action: action,
      label: 'Agent $action',
    );
  }

  Future<void> runAalScript(String scriptPath) async {
    await sendCloudUtility(
      utility: 'aal',
      action: 'run_script',
      label: 'Run AAL script',
      payload: {'path': scriptPath},
    );
  }

  Future<void> probeHardware({String target = 'all'}) async {
    await sendCloudUtility(
      utility: 'hardware',
      action: 'probe',
      label: 'Probe hardware nodes',
      payload: {'target': target},
    );
  }

  Future<void> sendApprovalDecision({
    required String id,
    required bool approved,
  }) async {
    await sendCloudUtility(
      utility: 'approval',
      action: approved ? 'approve' : 'reject',
      label: approved ? 'Approve action' : 'Reject action',
      payload: {'approval_id': id},
    );
    _approvals.removeWhere((approval) => approval.id == id);
    notifyListeners();
  }

  Future<void> sendCloudUtility({
    required String utility,
    required String action,
    required String label,
    Map<String, dynamic> payload = const {},
  }) async {
    _log('utility', '$label via $utility/$action');
    notifyListeners();

    if (!isConnected) {
      _lastError = 'Not connected to APEX cloud relay';
      _log('error', _lastError!);
      notifyListeners();
      return;
    }

    try {
      await _socket!.sendEncrypted({
        'type': 'utility_request',
        'utility': utility,
        'action': action,
        'label': label,
        'payload': payload,
        'ts': DateTime.now().toUtc().toIso8601String(),
      });
      _lastError = null;
      _log('tx', '$utility/$action');
    } catch (e) {
      _lastError = e.toString();
      _log('error', _lastError!);
    }

    notifyListeners();
  }

  void clearActivity() {
    _logs.clear();
    _messages.clear();
    _approvals.clear();
    _tasks.clear();
    _lastError = null;
    notifyListeners();
  }

  void _ingestCloudMessage(Map<String, dynamic> msg) {
    final type = (msg['type'] ?? '').toString();
    if (type == 'approval_request') {
      final payload = _asMap(msg['payload']);
      final id = (msg['id'] ?? payload['id'] ?? '').toString();
      if (id.isEmpty) return;
      _approvals.removeWhere((approval) => approval.id == id);
      _approvals.insert(
        0,
        ApexApprovalRequest(
          id: id,
          title: (msg['title'] ?? payload['title'] ?? 'Approval required')
              .toString(),
          command: (msg['command'] ?? payload['command'] ?? '').toString(),
          risk: (msg['risk'] ?? payload['risk'] ?? 'medium').toString(),
          path: (msg['path'] ?? payload['path'] ?? '').toString(),
        ),
      );
    }

    if (type == 'task_update' || type == 'agent_status') {
      final payload = _asMap(msg['payload']);
      final id = (msg['id'] ?? payload['id'] ?? 'apex-agent').toString();
      _tasks.removeWhere((task) => task.id == id);
      _tasks.insert(
        0,
        ApexTaskStatus(
          id: id,
          title: (msg['title'] ?? payload['title'] ?? 'APEX task').toString(),
          status: (msg['status'] ?? payload['status'] ?? type).toString(),
          progress: _progressFrom(msg['progress'] ?? payload['progress']),
        ),
      );
    }
  }

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    return const {};
  }

  double _progressFrom(dynamic value) {
    if (value is num) return value.toDouble().clamp(0.0, 1.0);
    return 0;
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
