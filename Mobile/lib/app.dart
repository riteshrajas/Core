import 'package:flutter/material.dart';

import 'config/env.dart';
import 'theme/app_theme.dart';
import 'live/live_session.dart';
import 'live/live_session_scope.dart';
import 'ui/live/gemini_live_screen.dart';

class ApexMobileApp extends StatefulWidget {
  const ApexMobileApp({super.key});

  @override
  State<ApexMobileApp> createState() => _ApexMobileAppState();
}

class _ApexMobileAppState extends State<ApexMobileApp> {
  late final LiveSession _session;

  @override
  void initState() {
    super.initState();
    _session = LiveSession(
      agentId: Env.get('ELEVENLABS_AGENT_ID'),
      signedUrl: Env.get('ELEVENLABS_SIGNED_URL'),
      apiKey: Env.get('ELEVENLABS_API_KEY'),
    );
  }

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LiveSessionScope(
      session: _session,
      child: MaterialApp(
        title: 'Apex Mobile Client',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: ThemeMode.dark,
        home: const GeminiLiveScreen(),
      ),
    );
  }
}
