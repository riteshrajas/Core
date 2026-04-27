import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class CallMode {
  static const MethodChannel _channel = MethodChannel('apex/call_mode');

  static Future<void> enable() async {
    if (defaultTargetPlatform != TargetPlatform.android) return;
    try {
      await _channel.invokeMethod<void>('enable');
    } on MissingPluginException {
      // Native channel not registered (requires full restart after Android-side changes).
    }
  }

  static Future<void> disable() async {
    if (defaultTargetPlatform != TargetPlatform.android) return;
    try {
      await _channel.invokeMethod<void>('disable');
    } on MissingPluginException {
      // Native channel not registered (requires full restart after Android-side changes).
    }
  }

  static Future<void> setSpeakerphoneOn(bool on) async {
    if (defaultTargetPlatform != TargetPlatform.android) return;
    try {
      await _channel.invokeMethod<void>('setSpeakerphoneOn', on);
    } on MissingPluginException {
      // Native channel not registered.
    }
  }
}
