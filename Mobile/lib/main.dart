import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Apex Mobile Client',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.deepPurple,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.deepPurple,
        brightness: Brightness.dark,
      ),
      themeMode: ThemeMode.system,
      home: const HomeShell(),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _selectedIndex = 0;

  final List<Widget> _pages = [
    const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.dashboard, size: 64, color: Colors.deepPurple),
          SizedBox(height: 16),
          Text('Dashboard', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          Text('System status and active tasks will appear here.', textAlign: TextAlign.center),
        ],
      ),
    ),
    const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.terminal, size: 64, color: Colors.deepPurple),
          SizedBox(height: 16),
          Text('Commands', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          Text('Issue natural-language commands to your laptop.', textAlign: TextAlign.center),
        ],
      ),
    ),
    const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.person, size: 64, color: Colors.deepPurple),
          SizedBox(height: 16),
          Text('Profile', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          Text('Manage your connection and account settings.', textAlign: TextAlign.center),
        ],
      ),
    ),
  ];

  final List<String> _titles = ['Dashboard', 'Commands', 'Profile'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_selectedIndex]),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.3),
      ),
      body: SafeArea(child: _pages[_selectedIndex]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (int index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        destinations: const <NavigationDestination>[
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
