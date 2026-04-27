import 'package:flutter/material.dart';

import 'live_session.dart';

class LiveSessionScope extends InheritedNotifier<LiveSession> {
  const LiveSessionScope({
    super.key,
    required LiveSession session,
    required super.child,
  }) : super(notifier: session);

  static LiveSession of(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<LiveSessionScope>();
    if (scope == null) {
      throw StateError('LiveSessionScope not found in widget tree');
    }
    return scope.notifier!;
  }
}
