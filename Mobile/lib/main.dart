import 'package:flutter/material.dart';

import 'app.dart';
import 'config/env.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Env.load();
  runApp(const ApexMobileApp());
}
