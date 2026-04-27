import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:record/record.dart';

class ElevenLabsService {
  final String apiKey;
  final String voiceId;

  // Base URL for ElevenLabs API
  static const String _baseUrl = 'https://api.elevenlabs.io/v1';

  final AudioRecorder _recorder = AudioRecorder();

  ElevenLabsService({
    required this.apiKey,
    this.voiceId = '21m00Tcm4TlvDq8ikWAM', // Default "Rachel" voice
  });

  /// Converts text to speech and returns the audio bytes
  Future<List<int>> textToSpeech(String text) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/text-to-speech/$voiceId'),
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'accept': 'audio/mpeg',
      },
      body: jsonEncode({
        'text': text,
        'model_id': 'eleven_monolingual_v1',
        'voice_settings': {'stability': 0.5, 'similarity_boost': 0.5},
      }),
    );

    if (response.statusCode == 200) {
      return response.bodyBytes;
    } else {
      throw Exception('Failed to generate speech: ${response.body}');
    }
  }

  /// Placeholder for Conversational AI (Voice-to-Text)
  /// Note: ElevenLabs primarily uses WebSockets for their real-time Conversational AI.
  /// This is a simplified wrapper for intent parsing.
  Future<String> transcribeAndParseIntent(List<int> audioBytes) async {
    // In a real implementation, you would stream this to ElevenLabs WebSocket.
    // For this prototype, we assume a mock transcription for the intent mapper.
    return "MOCK_TRANSCRIPTION";
  }

  Future<bool> hasPermission() async {
    return await _recorder.hasPermission();
  }
}
