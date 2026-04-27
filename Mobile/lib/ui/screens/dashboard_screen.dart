import 'package:flutter/material.dart';

import '../../state/apex_client_scope.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

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
                Text(
                  'Connection',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Icon(
                      client.isConnected ? Icons.wifi : Icons.wifi_off,
                      color: client.isConnected
                          ? scheme.primary
                          : scheme.outline,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        client.serverUri.toString(),
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
                if (client.lastError != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: scheme.errorContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      client.lastError!,
                      style: TextStyle(color: scheme.onErrorContainer),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: client.isConnected || client.isConnecting
                            ? null
                            : client.connect,
                        icon: const Icon(Icons.link),
                        label: Text(
                          client.isConnecting ? 'Connecting…' : 'Connect',
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: client.isConnected
                            ? client.disconnect
                            : null,
                        icon: const Icon(Icons.link_off),
                        label: const Text('Disconnect'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                icon: Icons.inbox,
                label: 'Messages',
                value: client.messages.length.toString(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                icon: Icons.receipt_long,
                label: 'Activity',
                value: client.logs.length.toString(),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Recent Activity',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    TextButton(
                      onPressed: client.logs.isEmpty
                          ? null
                          : client.clearActivity,
                      child: const Text('Clear'),
                    ),
                  ],
                ),
                const Divider(height: 16),
                if (client.logs.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      'No activity yet. Connect and send a command.',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                  )
                else
                  ...client.logs
                      .take(8)
                      .map(
                        (e) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                margin: const EdgeInsets.only(top: 3),
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: scheme.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      e.label.toUpperCase(),
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelSmall
                                          ?.copyWith(
                                            letterSpacing: 0.6,
                                            color: scheme.onSurfaceVariant,
                                          ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      e.message,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: scheme.secondaryContainer,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: scheme.onSecondaryContainer),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(color: scheme.onSurfaceVariant)),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
