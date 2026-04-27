import 'package:flutter/material.dart';

import 'apex_client.dart';

class ApexClientScope extends InheritedNotifier<ApexClient> {
  const ApexClientScope({
    super.key,
    required ApexClient client,
    required super.child,
  }) : super(notifier: client);

  static ApexClient of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<ApexClientScope>();
    if (scope == null) {
      throw StateError('ApexClientScope not found in widget tree');
    }
    return scope.notifier!;
  }
}
