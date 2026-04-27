import 'package:flutter/material.dart';

import '../../state/apex_client_scope.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final TextEditingController _serverController;
  bool _seededFromClient = false;

  @override
  void initState() {
    super.initState();
    _serverController = TextEditingController();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_seededFromClient) return;
    final client = ApexClientScope.of(context);
    _serverController.text = client.serverUri.toString();
    _seededFromClient = true;
  }

  @override
  void dispose() {
    _serverController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final client = ApexClientScope.of(context);
    final scheme = Theme.of(context).colorScheme;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Server', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
                TextField(
                  controller: _serverController,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    labelText: 'WebSocket URL',
                    hintText: 'ws://<host>:<port>/ws',
                    prefixIcon: Icon(Icons.public),
                  ),
                  onSubmitted: (v) => client.setServerUri(v),
                ),
                const SizedBox(height: 10),
                Text(
                  'Tip: for Android emulator use `ws://10.0.2.2:<port>/ws`.',
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: () =>
                            client.setServerUri(_serverController.text),
                        child: const Text('Save'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: client.isConnected
                            ? client.disconnect
                            : client.connect,
                        child: Text(
                          client.isConnected ? 'Disconnect' : 'Connect',
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('About', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text(
                  'Apex Mobile Client is a lightweight companion UI for sending commands and tracking status.',
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: client.clearActivity,
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Clear activity'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
