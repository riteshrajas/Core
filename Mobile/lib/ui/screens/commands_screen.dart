import 'package:flutter/material.dart';

import '../../state/apex_client_scope.dart';

class CommandsScreen extends StatefulWidget {
  const CommandsScreen({super.key});

  @override
  State<CommandsScreen> createState() => _CommandsScreenState();
}

class _CommandsScreenState extends State<CommandsScreen> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _send(BuildContext context) async {
    final client = ApexClientScope.of(context);
    final text = _controller.text;
    await client.sendNaturalLanguage(text);
    if (client.lastError == null) {
      _controller.clear();
      _focusNode.requestFocus();
    } else if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(client.lastError!)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final client = ApexClientScope.of(context);
    final scheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Send a command',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _send(context),
                    decoration: const InputDecoration(
                      hintText: 'e.g. “open Core/RAM” or “run flutter analyze”',
                      prefixIcon: Icon(Icons.auto_awesome),
                    ),
                    minLines: 1,
                    maxLines: 3,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: client.isConnected
                              ? () => _send(context)
                              : null,
                          icon: const Icon(Icons.send),
                          label: const Text('Send'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      OutlinedButton.icon(
                        onPressed: client.isConnected
                            ? client.disconnect
                            : client.connect,
                        icon: Icon(
                          client.isConnected ? Icons.link_off : Icons.link,
                        ),
                        label: Text(
                          client.isConnected ? 'Disconnect' : 'Connect',
                        ),
                      ),
                    ],
                  ),
                  if (!client.isConnected)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(
                        'Connect to your Apex host to send commands.',
                        style: TextStyle(color: scheme.onSurfaceVariant),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            itemCount: client.messages.take(50).length,
            separatorBuilder: (context, index) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final msg = client.messages[index];
              final type = (msg['type'] ?? 'message').toString();
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: scheme.secondaryContainer,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              type.toUpperCase(),
                              style: TextStyle(
                                color: scheme.onSecondaryContainer,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.6,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          const Spacer(),
                          Icon(
                            Icons.markunread,
                            size: 18,
                            color: scheme.onSurfaceVariant,
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        msg.toString(),
                        style: TextStyle(color: scheme.onSurface),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
