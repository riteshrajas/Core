enum ApexCommand {
  openApp,
  readFile,
  runShell,
  checkProgress,
  unknown
}

class IntentMapper {
  /// Maps a natural language string to a specific ApexCommand and its parameters.
  Map<String, dynamic> parse(String text) {
    final input = text.toLowerCase();

    if (input.contains('open') || input.contains('launch')) {
      return {
        'command': ApexCommand.openApp,
        'params': {'app': _extractTarget(input, ['open', 'launch'])}
      };
    }

    if (input.contains('read') || input.contains('pull up') || input.contains('show file')) {
      return {
        'command': ApexCommand.readFile,
        'params': {'file': _extractTarget(input, ['read', 'pull up', 'show file'])}
      };
    }

    if (input.contains('run') || input.contains('execute')) {
      return {
        'command': ApexCommand.runShell,
        'params': {'command': _extractTarget(input, ['run', 'execute'])}
      };
    }

    if (input.contains('progress') || input.contains('status')) {
      return {
        'command': ApexCommand.checkProgress,
        'params': {}
      };
    }

    return {
      'command': ApexCommand.unknown,
      'params': {'original': text}
    };
  }

  String _extractTarget(String input, List<String> keywords) {
    String result = input;
    for (var kw in keywords) {
      if (result.contains(kw)) {
        result = result.split(kw).last.trim();
      }
    }
    return result;
  }
}
