import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../live/live_session.dart';
import '../../live/live_session_scope.dart';
import 'widgets/live_orb.dart';
import 'widgets/live_transcript.dart';

class GeminiLiveScreen extends StatefulWidget {
  const GeminiLiveScreen({super.key});

  @override
  State<GeminiLiveScreen> createState() => _GeminiLiveScreenState();
}

class _GeminiLiveScreenState extends State<GeminiLiveScreen> {
  LiveConnectionState? _lastState;

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _syncSystemUi(LiveConnectionState state) {
    final immersive =
        state == LiveConnectionState.connecting ||
        state == LiveConnectionState.connected;
    SystemChrome.setEnabledSystemUIMode(
      immersive ? SystemUiMode.immersiveSticky : SystemUiMode.edgeToEdge,
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = LiveSessionScope.of(context);
    if (_lastState != session.state) {
      final oldState = _lastState;
      _lastState = session.state;
      _syncSystemUi(session.state);

      if (session.state == LiveConnectionState.error &&
          oldState != LiveConnectionState.error) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Session Error: ${session.lastError}')),
            );
          }
        });
      }
    }

    final status = switch (session.state) {
      LiveConnectionState.connecting => 'Calling…',
      LiveConnectionState.connected => 'In call',
      LiveConnectionState.error => session.lastError ?? 'Error',
      _ => 'Ready',
    };

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          LiveOrb(
            inputLevel: session.inputLevel,
            agentLevel: session.agentLevel,
            listening: session.micOn,
            speaking: session.speechActive,
            connected: session.state == LiveConnectionState.connected,
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 12, 20),
              child: Column(
                children: [
                  Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'APEX',
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                  color: Colors.white,
                                ),
                          ),
                          Text(
                            status,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.7),
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      _CallHeader(
                        state: session.state,
                        duration: session.callDuration,
                      ),
                      IconButton(
                        tooltip: 'Settings',
                        onPressed: () => _showSettings(context),
                        icon: const Icon(Icons.tune, color: Colors.white70),
                      ),
                    ],
                  ),
                  const Spacer(flex: 7),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 760),
                    child: LiveTranscript(turns: session.turns),
                  ),
                  const Spacer(flex: 2),
                  _BottomControls(
                    micOn: session.micOn,
                    speakerOn: session.speakerOn,
                    connected: session.state == LiveConnectionState.connected,
                    connecting: session.state == LiveConnectionState.connecting,
                    lastError: session.lastError,
                    onMicPressed: session.toggleMic,
                    onSpeakerPressed: session.toggleSpeaker,
                    onConnectPressed: () async {
                      try {
                        await session.startCall();
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Connect Error: $e')),
                          );
                        }
                      }
                    },
                    onClearPressed: session.clear,
                    onEndCallPressed: session.endCall,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showSettings(BuildContext context) async {
    final session = LiveSessionScope.of(context);
    final agentIdController = TextEditingController(text: session.agentId);
    final signedUrlController = TextEditingController(text: session.signedUrl);
    final apiKeyController = TextEditingController(text: session.apiKey);

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        final scheme = Theme.of(context).colorScheme;
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 12,
            right: 12,
            top: 12,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                color: scheme.surface.withValues(alpha: 0.75),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'ElevenLabs',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const Spacer(),
                        IconButton(
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.close),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: agentIdController,
                      decoration: const InputDecoration(
                        labelText: 'Agent ID (public)',
                        hintText: 'agent_…',
                        prefixIcon: Icon(Icons.smart_toy_outlined),
                      ),
                      onChanged: session.setAgentId,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: signedUrlController,
                      decoration: const InputDecoration(
                        labelText: 'Signed URL (private)',
                        hintText: 'wss://…token=…',
                        prefixIcon: Icon(Icons.lock_outline),
                      ),
                      onChanged: session.setSignedUrl,
                      minLines: 1,
                      maxLines: 3,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: apiKeyController,
                      decoration: const InputDecoration(
                        labelText: 'API key (dev-only)',
                        hintText: 'xi-…',
                        prefixIcon: Icon(Icons.key_outlined),
                      ),
                      onChanged: session.setApiKey,
                      obscureText: true,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('Auto detect speech'),
                            value: session.autoVad,
                            onChanged: session.setAutoVad,
                          ),
                        ),
                      ],
                    ),
                    Slider(
                      value: session.vadSensitivity,
                      min: 1.05,
                      max: 2.2,
                      divisions: 23,
                      label: session.vadSensitivity.toStringAsFixed(2),
                      onChanged: session.setVadSensitivity,
                    ),
                    Text(
                      'VAD: ${session.vadState.name}  floor ${session.vadNoiseFloor.toStringAsFixed(3)}  '
                      'speech ${session.vadSpeechThreshold.toStringAsFixed(3)}  '
                      'silence ${session.vadSilenceThreshold.toStringAsFixed(3)}',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Best practice: generate the signed URL on your server. Don’t ship API keys in the app.',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: () async {
                              await session.disconnect();
                              await session.connect();
                              if (context.mounted) Navigator.of(context).pop();
                            },
                            icon: const Icon(Icons.link),
                            label: const Text('Connect'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _TopPill extends StatelessWidget {
  final String label;
  final bool active;

  const _TopPill({required this.label, required this.active});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bg = active
        ? scheme.primaryContainer
        : scheme.surfaceContainerHighest;
    final fg = active ? scheme.onPrimaryContainer : scheme.onSurface;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: bg.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: scheme.outlineVariant.withValues(alpha: 0.35),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.0,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _BottomControls extends StatelessWidget {
  final bool micOn;
  final bool speakerOn;
  final bool connected;
  final bool connecting;
  final String? lastError;
  final VoidCallback onMicPressed;
  final VoidCallback onSpeakerPressed;
  final VoidCallback onConnectPressed;
  final VoidCallback onClearPressed;
  final VoidCallback onEndCallPressed;

  const _BottomControls({
    required this.micOn,
    required this.speakerOn,
    required this.connected,
    required this.connecting,
    required this.lastError,
    required this.onMicPressed,
    required this.onSpeakerPressed,
    required this.onConnectPressed,
    required this.onClearPressed,
    required this.onEndCallPressed,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return ClipRRect(
      borderRadius: BorderRadius.circular(26),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          decoration: BoxDecoration(
            color: scheme.surface.withValues(alpha: 0.55),
            border: Border.all(
              color: scheme.outlineVariant.withValues(alpha: 0.35),
            ),
            borderRadius: BorderRadius.circular(26),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (lastError != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, color: scheme.error, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          lastError!,
                          style: TextStyle(color: scheme.onSurface),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              Row(
                children: [
                  IconButton(
                    tooltip: speakerOn ? 'Speaker Off' : 'Speaker On',
                    onPressed: onSpeakerPressed,
                    icon: Icon(speakerOn ? Icons.volume_up : Icons.volume_down),
                    color: speakerOn ? scheme.primary : null,
                  ),
                  const Spacer(),
                  _MicButton(
                    micOn: micOn,
                    enabled: connected || connecting,
                    connecting: connecting,
                    onPressed: connected ? onMicPressed : onConnectPressed,
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: connected ? 'End call' : 'Call',
                    onPressed: connected ? onEndCallPressed : onConnectPressed,
                    icon: Icon(connected ? Icons.call_end : Icons.call),
                    color: connected ? scheme.error : null,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CallHeader extends StatelessWidget {
  final LiveConnectionState state;
  final Duration duration;

  const _CallHeader({required this.state, required this.duration});

  @override
  Widget build(BuildContext context) {
    final active = state == LiveConnectionState.connected;
    final label = active
        ? _formatDuration(duration)
        : (state == LiveConnectionState.connecting ? 'Dialing' : 'Idle');
    return _TopPill(label: label, active: active);
  }

  String _formatDuration(Duration d) {
    final s = d.inSeconds;
    final mm = (s ~/ 60).toString().padLeft(2, '0');
    final ss = (s % 60).toString().padLeft(2, '0');
    return '$mm:$ss';
  }
}

class _MicButton extends StatelessWidget {
  final bool micOn;
  final bool enabled;
  final bool connecting;
  final VoidCallback onPressed;

  const _MicButton({
    required this.micOn,
    required this.enabled,
    required this.connecting,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    final bg = micOn ? scheme.primary : scheme.surfaceContainerHighest;
    final fg = micOn ? scheme.onPrimary : scheme.onSurface;

    return AnimatedScale(
      scale: micOn ? 1.08 : 1.0,
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
      child: SizedBox(
        width: 76,
        height: 76,
        child: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: bg.withValues(alpha: enabled ? 0.9 : 0.35),
            foregroundColor: fg,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          onPressed: enabled ? onPressed : null,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            child: connecting
                ? const SizedBox(
                    key: ValueKey('spinner'),
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  )
                : Icon(
                    micOn ? Icons.stop_rounded : Icons.mic_rounded,
                    key: ValueKey(micOn ? 'stop' : 'mic'),
                    size: 30,
                  ),
          ),
        ),
      ),
    );
  }
}
