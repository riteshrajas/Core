import 'package:flutter/services.dart';

class Env {
  static Map<String, String> _values = const {};

  static Future<void> load({String assetPath = '.env'}) async {
    try {
      final raw = await rootBundle.loadString(assetPath);
      _values = _parse(raw);
    } catch (_) {
      _values = const {};
    }
  }

  static String get(String key, {String fallback = ''}) {
    return _values[key] ?? fallback;
  }

  static Map<String, String> _parse(String raw) {
    final map = <String, String>{};
    for (final line in raw.split('\n')) {
      final trimmed = line.trim();
      if (trimmed.isEmpty) continue;
      if (trimmed.startsWith('#')) continue;
      final idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      final k = trimmed.substring(0, idx).trim();
      final v = trimmed.substring(idx + 1).trim();
      map[k] = v;
    }
    return map;
  }
}
