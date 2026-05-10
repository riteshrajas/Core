import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:glow_orb/glow_orb.dart';

class LiveOrb extends StatelessWidget {
  final double inputLevel;
  final double agentLevel;
  final bool listening;
  final bool speaking;
  final bool connected;
  final VoidCallback? onPressed;

  const LiveOrb({
    super.key,
    required this.inputLevel,
    required this.agentLevel,
    required this.listening,
    required this.speaking,
    required this.connected,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final shortest = size.shortestSide;
    final energy = (inputLevel * 0.85 + agentLevel * 0.95).clamp(0.0, 1.0);

    final orbSize = shortest * (connected ? 0.66 : 0.62);
    final floatIntensity = connected ? (2.0 + energy * 3.0) : 1.2;
    final lookIntensity = connected
        ? (2.0 + energy * 2.5 + (speaking ? 1.2 : 0.0))
        : 1.2;
    final borderOpacity = connected ? (0.28 + energy * 0.16) : 0.15;
    final innerOpacity = connected ? (0.04 + energy * 0.08) : 0.03;

    final orb = Align(
      alignment: const Alignment(0, -0.06),
      child: SizedBox(
        width: orbSize,
        height: orbSize,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onPressed,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _InnerOrbGradient(
                connected: connected,
                energy: energy,
                speaking: speaking,
              ),
              GlowOrb(
                size: orbSize,
                backgroundColor: Colors.transparent,
                eyeColor: connected ? const Color(0xFFE2F7FF) : Colors.white70,
                eyeWidth: connected ? 16.0 : 14.0,
                eyeHeight: connected ? 34.0 : 30.0,
                eyeSpacing: connected ? 40.0 : 36.0,
                eyeBorderRadius: 6.0,
                enableBlinking: true,
                enableLookAround: true,
                enableFloating: true,
                enableColorShift: false,
                floatIntensity: floatIntensity,
                lookAroundIntensity: lookIntensity,
                borderWidth: connected ? 1.6 : 1.0,
                borderOpacity: borderOpacity,
                innerGradientOpacity: innerOpacity,
                colorBlobs: const [],
                customColorScheme: connected
                    ? const [
                        Color(0xFF67E8F9),
                        Color(0xFF22D3EE),
                        Color(0xFF38BDF8),
                      ]
                    : const [Color(0xFF334155), Color(0xFF1E293B)],
              ),
              _RainbowRing(enabled: connected, energy: energy),
            ],
          ),
        ),
      ),
    );

    return Positioned.fill(
      child: Container(
        color: Colors.black,
        child: onPressed == null ? IgnorePointer(child: orb) : orb,
      ),
    );
  }
}

class _InnerOrbGradient extends StatelessWidget {
  final bool connected;
  final bool speaking;
  final double energy;

  const _InnerOrbGradient({
    required this.connected,
    required this.speaking,
    required this.energy,
  });

  @override
  Widget build(BuildContext context) {
    if (!connected) {
      return const SizedBox.shrink();
    }

    final coreOpacity = 0.05 + energy * 0.05 + (speaking ? 0.03 : 0.0);
    final bloomOpacity = 0.04 + energy * 0.05;

    return ClipOval(
      child: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0.0, -0.10),
                radius: 0.56,
                colors: [
                  const Color(0xFF67E8F9).withValues(alpha: coreOpacity),
                  const Color(0xFF38BDF8).withValues(alpha: coreOpacity * 0.58),
                  const Color(
                    0xFF1D4ED8,
                  ).withValues(alpha: bloomOpacity * 0.52),
                  Colors.transparent,
                ],
                stops: const [0.0, 0.18, 0.36, 1.0],
              ),
            ),
          ),
          ImageFiltered(
            imageFilter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: const Alignment(-0.7, -0.9),
                  end: const Alignment(0.8, 0.9),
                  colors: [
                    const Color(
                      0xFF67E8F9,
                    ).withValues(alpha: bloomOpacity * 0.62),
                    const Color(
                      0xFF22D3EE,
                    ).withValues(alpha: bloomOpacity * 0.26),
                    const Color(
                      0xFF2563EB,
                    ).withValues(alpha: bloomOpacity * 0.48),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RainbowRing extends StatefulWidget {
  final bool enabled;
  final double energy;

  const _RainbowRing({required this.enabled, required this.energy});

  @override
  State<_RainbowRing> createState() => _RainbowRingState();
}

class _RainbowRingState extends State<_RainbowRing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _rotation;

  @override
  void initState() {
    super.initState();
    _rotation = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
  }

  @override
  void dispose() {
    _rotation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) {
      return const SizedBox.shrink();
    }

    final ringOpacity = (0.72 + widget.energy * 0.22).clamp(0.0, 1.0);
    final ringThickness = 18.0 + widget.energy * 12.0;

    return AnimatedBuilder(
      animation: _rotation,
      builder: (context, child) {
        return CustomPaint(
          painter: _RainbowRingPainter(
            rotation: _rotation.value,
            ringOpacity: ringOpacity,
            ringThickness: ringThickness,
          ),
        );
      },
    );
  }
}

class _RainbowRingPainter extends CustomPainter {
  final double rotation;
  final double ringOpacity;
  final double ringThickness;

  const _RainbowRingPainter({
    required this.rotation,
    required this.ringOpacity,
    required this.ringThickness,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = (size.shortestSide / 2) - 4;
    final outerRadius = (maxRadius * 0.54).clamp(0.0, maxRadius);
    final innerRadius = (outerRadius - ringThickness).clamp(0.0, outerRadius);
    final rect = Rect.fromCircle(center: center, radius: outerRadius);

    final shader = SweepGradient(
      transform: GradientRotation(rotation * 6.283185307179586),
      colors: [
        const Color(0xFFFF2D55).withValues(alpha: ringOpacity),
        const Color(0xFFFF9500).withValues(alpha: ringOpacity),
        const Color(0xFFFFD60A).withValues(alpha: ringOpacity),
        const Color(0xFF32D74B).withValues(alpha: ringOpacity),
        const Color(0xFF64D2FF).withValues(alpha: ringOpacity),
        const Color(0xFF0A84FF).withValues(alpha: ringOpacity),
        const Color(0xFFBF5AF2).withValues(alpha: ringOpacity),
        const Color(0xFFFF2D55).withValues(alpha: ringOpacity),
      ],
    ).createShader(rect);

    final ringPath = Path()
      ..fillType = PathFillType.evenOdd
      ..addOval(Rect.fromCircle(center: center, radius: outerRadius))
      ..addOval(Rect.fromCircle(center: center, radius: innerRadius));

    final paint = Paint()
      ..style = PaintingStyle.fill
      ..shader = shader
      ..blendMode = BlendMode.plus;

    final blurPaint = Paint()
      ..style = PaintingStyle.fill
      ..shader = shader
      ..blendMode = BlendMode.plus
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4.0);

    canvas.drawPath(ringPath, blurPaint);
    canvas.drawPath(ringPath, paint);
  }

  @override
  bool shouldRepaint(covariant _RainbowRingPainter oldDelegate) {
    return rotation != oldDelegate.rotation ||
        ringOpacity != oldDelegate.ringOpacity ||
        ringThickness != oldDelegate.ringThickness;
  }
}
