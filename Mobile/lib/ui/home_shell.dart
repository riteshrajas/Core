import 'package:flutter/material.dart';

import '../state/apex_client_scope.dart';
import 'screens/commands_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/profile_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _selectedIndex = 0;

  final _pages = const [DashboardScreen(), CommandsScreen(), ProfileScreen()];

  final _titles = const ['Dashboard', 'Commands', 'Profile'];

  @override
  Widget build(BuildContext context) {
    final client = ApexClientScope.of(context);
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_selectedIndex]),
        actions: [
          if (_selectedIndex != 2)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: _ConnectionPill(
                  connected: client.isConnected,
                  connecting: client.isConnecting,
                ),
              ),
            ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            height: 1,
            color: colorScheme.outlineVariant.withValues(alpha: 0.5),
          ),
        ),
      ),
      body: SafeArea(child: _pages[_selectedIndex]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) =>
            setState(() => _selectedIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.terminal_outlined),
            selectedIcon: Icon(Icons.terminal),
            label: 'Commands',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class _ConnectionPill extends StatelessWidget {
  final bool connected;
  final bool connecting;

  const _ConnectionPill({required this.connected, required this.connecting});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    final (label, bg, fg, icon) = switch ((connected, connecting)) {
      (true, _) => (
        'Connected',
        scheme.primaryContainer,
        scheme.onPrimaryContainer,
        Icons.wifi,
      ),
      (false, true) => (
        'Connecting',
        scheme.tertiaryContainer,
        scheme.onTertiaryContainer,
        Icons.sync,
      ),
      _ => (
        'Offline',
        scheme.surfaceContainerHighest,
        scheme.onSurface,
        Icons.wifi_off,
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(color: fg, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
