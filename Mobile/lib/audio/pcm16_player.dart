import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class Pcm16Player {
  static const MethodChannel _channel = MethodChannel('apex/pcm16_player');

  bool _initialized = false;
  bool _playing = false;
  final BytesBuilder _buffer = BytesBuilder(copy: false);
  Timer? _flushTimer;

  Future<void> init({int sampleRate = 16000, int channels = 1}) async {
    if (_initialized) return;
    if (defaultTargetPlatform != TargetPlatform.android) {
      _initialized = true;
      return;
    }

    await _channel.invokeMethod<void>('init', {
      'sampleRate': sampleRate,
      'channels': channels,
    });
    _initialized = true;
  }

  Future<void> start() async {
    if (_playing) return;
    if (defaultTargetPlatform != TargetPlatform.android) {
      _playing = true;
      return;
    }
    await _channel.invokeMethod<void>('start');
    _playing = true;
  }

  Future<void> write(Uint8List bytes) async {
    if (!_playing) return;
    if (defaultTargetPlatform != TargetPlatform.android) return;
    // Batch small chunks to reduce MethodChannel overhead (which can cause UI jank).
    if (_buffer.length > 512 * 1024) {
      _buffer.clear();
    }
    _buffer.add(bytes);

    // Flush quickly if buffer is already sizable.
    if (_buffer.length >= 4096) {
      await _flushNow();
      return;
    }

    _flushTimer ??= Timer(const Duration(milliseconds: 40), () {
      _flushTimer = null;
      unawaited(_flushNow());
    });
  }

  Future<void> _flushNow() async {
    if (!_playing) return;
    if (_buffer.isEmpty) return;
    final chunk = _buffer.takeBytes();
    await _channel.invokeMethod<void>('write', chunk);
  }

  Future<void> stop() async {
    if (!_playing) return;
    if (defaultTargetPlatform == TargetPlatform.android) {
      _flushTimer?.cancel();
      _flushTimer = null;
      if (_buffer.isNotEmpty) {
        await _flushNow();
      }
      await _channel.invokeMethod<void>('stop');
    }
    _playing = false;
  }

  Future<void> dispose() async {
    await stop();
    if (_initialized && defaultTargetPlatform == TargetPlatform.android) {
      await _channel.invokeMethod<void>('dispose');
    }
    _initialized = false;
  }
}
