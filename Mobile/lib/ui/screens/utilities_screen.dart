import 'package:flutter/material.dart';

import '../../state/apex_client.dart';
import '../../state/apex_client_scope.dart';

class UtilitiesScreen extends StatelessWidget {
  const UtilitiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final client = ApexClientScope.of(context);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        _SectionHeader(
          title: 'Mission Utilities',
          subtitle: 'Cloud-routed controls for the APEX host and agents.',
          action: FilledButton.icon(
            onPressed: client.isConnected ? client.requestHostStatus : null,
            icon: const Icon(Icons.sync),
            label: const Text('Refresh'),
          ),
        ),
        const SizedBox(height: 12),
        _UtilityGrid(
          utilities: [
            _UtilityAction(
              icon: Icons.computer,
              title: 'Host Snapshot',
              subtitle: 'OS, repo, branch, services',
              onTap: client.requestHostStatus,
            ),
            _UtilityAction(
              icon: Icons.history,
              title: 'Away Summary',
              subtitle: 'What changed since last check',
              onTap: client.requestAwaySummary,
            ),
            _UtilityAction(
              icon: Icons.psychology_alt,
              title: 'Agent Pause',
              subtitle: 'Pause active autonomous work',
              onTap: () => client.sendAgentControl('pause'),
            ),
            _UtilityAction(
              icon: Icons.play_arrow,
              title: 'Agent Resume',
              subtitle: 'Resume the current task plan',
              onTap: () => client.sendAgentControl('resume'),
            ),
          ],
        ),
        const SizedBox(height: 18),
        _CommandPresetPanel(client: client),
        const SizedBox(height: 18),
        _ApprovalsPanel(client: client),
        const SizedBox(height: 18),
        _AgentsPanel(client: client),
        const SizedBox(height: 18),
        _AalHardwarePanel(client: client),
      ],
    );
  }
}

class _CommandPresetPanel extends StatelessWidget {
  final ApexClient client;

  const _CommandPresetPanel({required this.client});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      icon: Icons.terminal,
      title: 'Command Presets',
      child: Column(
        children: [
          _PresetTile(
            label: 'Check Git Status',
            command: 'git status --short --branch',
            onRun: client.runCommandPreset,
          ),
          _PresetTile(
            label: 'Start RAM Dashboard',
            command: 'cd Core/RAM && npm run dev',
            onRun: client.runCommandPreset,
          ),
          _PresetTile(
            label: 'Build Mobile Debug APK',
            command: 'cd Core/Mobile && flutter build apk --debug',
            onRun: client.runCommandPreset,
          ),
          _PresetTile(
            label: 'Build MicroMax Uno',
            command: 'cd MicroMax/OS && platformio run -e uno',
            onRun: client.runCommandPreset,
          ),
        ],
      ),
    );
  }
}

class _ApprovalsPanel extends StatelessWidget {
  final ApexClient client;

  const _ApprovalsPanel({required this.client});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return _Panel(
      icon: Icons.verified_user,
      title: 'Approvals',
      trailing: Text(
        client.approvals.length.toString(),
        style: Theme.of(context).textTheme.titleMedium,
      ),
      child: client.approvals.isEmpty
          ? _EmptyState(
              icon: Icons.shield_outlined,
              text: 'Sensitive actions from the host will appear here.',
            )
          : Column(
              children: client.approvals
                  .map(
                    (approval) => Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: scheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  approval.title,
                                  style: Theme.of(context).textTheme.titleSmall,
                                ),
                              ),
                              _RiskPill(risk: approval.risk),
                            ],
                          ),
                          if (approval.command.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(
                              approval.command,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                          if (approval.path.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              approval.path,
                              style: TextStyle(color: scheme.onSurfaceVariant),
                            ),
                          ],
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () => client.sendApprovalDecision(
                                    id: approval.id,
                                    approved: false,
                                  ),
                                  icon: const Icon(Icons.close),
                                  label: const Text('Reject'),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: FilledButton.icon(
                                  onPressed: () => client.sendApprovalDecision(
                                    id: approval.id,
                                    approved: true,
                                  ),
                                  icon: const Icon(Icons.check),
                                  label: const Text('Approve'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
    );
  }
}

class _AgentsPanel extends StatelessWidget {
  final ApexClient client;

  const _AgentsPanel({required this.client});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return _Panel(
      icon: Icons.account_tree,
      title: 'Agent Operations',
      trailing: TextButton(
        onPressed: () => client.sendAgentControl('status'),
        child: const Text('Status'),
      ),
      child: client.tasks.isEmpty
          ? _EmptyState(
              icon: Icons.task_alt,
              text: 'Agent plans and active host tasks will stream here.',
            )
          : Column(
              children: client.tasks
                  .map(
                    (task) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  task.title,
                                  style: Theme.of(context).textTheme.titleSmall,
                                ),
                              ),
                              Text(
                                task.status,
                                style: TextStyle(
                                  color: scheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          LinearProgressIndicator(value: task.progress),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
    );
  }
}

class _AalHardwarePanel extends StatefulWidget {
  final ApexClient client;

  const _AalHardwarePanel({required this.client});

  @override
  State<_AalHardwarePanel> createState() => _AalHardwarePanelState();
}

class _AalHardwarePanelState extends State<_AalHardwarePanel> {
  final _aalController = TextEditingController(text: 'blink_led.aal');

  @override
  void dispose() {
    _aalController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _Panel(
      icon: Icons.hub,
      title: 'AAL & Hardware',
      child: Column(
        children: [
          TextField(
            controller: _aalController,
            decoration: const InputDecoration(
              labelText: 'AAL script path',
              prefixIcon: Icon(Icons.schema),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () =>
                      widget.client.runAalScript(_aalController.text),
                  icon: const Icon(Icons.play_circle),
                  label: const Text('Run AAL'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => widget.client.probeHardware(),
                  icon: const Icon(Icons.memory),
                  label: const Text('Probe Nodes'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _UtilityGrid extends StatelessWidget {
  final List<_UtilityAction> utilities;

  const _UtilityGrid({required this.utilities});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: utilities.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.18,
      ),
      itemBuilder: (context, index) => _UtilityCard(action: utilities[index]),
    );
  }
}

class _UtilityAction {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _UtilityAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
}

class _UtilityCard extends StatelessWidget {
  final _UtilityAction action;

  const _UtilityCard({required this.action});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Card(
      child: InkWell(
        onTap: action.onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(action.icon, color: scheme.primary),
              const Spacer(),
              Text(action.title, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 4),
              Text(
                action.subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: scheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PresetTile extends StatelessWidget {
  final String label;
  final String command;
  final Future<void> Function(String label, String command) onRun;

  const _PresetTile({
    required this.label,
    required this.command,
    required this.onRun,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.play_arrow),
      title: Text(label),
      subtitle: Text(command, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => onRun(label, command),
    );
  }
}

class _Panel extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget child;
  final Widget? trailing;

  const _Panel({
    required this.icon,
    required this.title,
    required this.child,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: scheme.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                ?trailing,
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget? action;

  const _SectionHeader({
    required this.title,
    required this.subtitle,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 4),
              Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant)),
            ],
          ),
        ),
        if (action != null) ...[const SizedBox(width: 12), action!],
      ],
    );
  }
}

class _RiskPill extends StatelessWidget {
  final String risk;

  const _RiskPill({required this.risk});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final highRisk = risk.toLowerCase().contains('high');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: highRisk ? scheme.errorContainer : scheme.secondaryContainer,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        risk.toUpperCase(),
        style: TextStyle(
          color: highRisk
              ? scheme.onErrorContainer
              : scheme.onSecondaryContainer,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String text;

  const _EmptyState({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Icon(icon, color: scheme.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: TextStyle(color: scheme.onSurfaceVariant)),
          ),
        ],
      ),
    );
  }
}
