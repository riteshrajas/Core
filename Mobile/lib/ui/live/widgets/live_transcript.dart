import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../live/live_session.dart';

class LiveTranscript extends StatelessWidget {
  final List<LiveTurn> turns;

  const LiveTranscript({super.key, required this.turns});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final visible = turns.take(2).toList();

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          decoration: BoxDecoration(
            color: scheme.surface.withValues(alpha: 0.42),
            border: Border.all(
              color: scheme.outlineVariant.withValues(alpha: 0.30),
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            child: visible.isEmpty
                ? Text(
                    'Tap the mic to start talking.',
                    key: const ValueKey('empty'),
                    style: TextStyle(color: scheme.onSurfaceVariant),
                    textAlign: TextAlign.center,
                  )
                : Column(
                    key: ValueKey(visible.map((t) => t.text).join('|')),
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final turn in visible) ...[
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              margin: const EdgeInsets.only(top: 2),
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: turn.fromUser
                                    ? scheme.tertiary
                                    : scheme.primary,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                turn.text,
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(
                                      height: 1.25,
                                      color: scheme.onSurface,
                                    ),
                              ),
                            ),
                          ],
                        ),
                        if (turn != visible.last) const SizedBox(height: 10),
                      ],
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
