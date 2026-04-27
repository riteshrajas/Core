package com.example.mobile

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import androidx.annotation.NonNull
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import io.flutter.plugin.common.MethodChannel.Result

class Pcm16PlayerChannel(flutterEngine: FlutterEngine) : MethodCallHandler {
  private val TAG = "ApexPcm16Player"
  private val channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "apex/pcm16_player")
  private var audioTrack: AudioTrack? = null
  private var sampleRate: Int = 16000
  private var channels: Int = 1
  private val audioThread = HandlerThread("ApexPcm16Player").apply { start() }
  private val audioHandler = Handler(audioThread.looper)

  init {
    channel.setMethodCallHandler(this)
  }

  override fun onMethodCall(@NonNull call: MethodCall, @NonNull result: Result) {
    when (call.method) {
      "init" -> {
        val sr = (call.argument<Int>("sampleRate") ?: 16000)
        val ch = (call.argument<Int>("channels") ?: 1)
        Log.d(TAG, "init: sr=$sr, ch=$ch")
        audioHandler.post {
          sampleRate = sr
          channels = ch
          ensureTrack()
        }
        result.success(null)
      }
      "start" -> {
        Log.d(TAG, "start")
        audioHandler.post {
          ensureTrack()
          audioTrack?.play()
        }
        result.success(null)
      }
      "write" -> {
        val bytes = call.arguments as? ByteArray
        if (bytes != null) {
          audioHandler.post {
            val track = audioTrack
            if (track != null) {
              if (Build.VERSION.SDK_INT >= 23) {
                track.write(bytes, 0, bytes.size, AudioTrack.WRITE_BLOCKING)
              } else {
                track.write(bytes, 0, bytes.size)
              }
            }
          }
        }
        result.success(null)
      }
      "stop" -> {
        Log.d(TAG, "stop")
        audioHandler.post {
          audioTrack?.pause()
          audioTrack?.flush()
        }
        result.success(null)
      }
      "dispose" -> {
        Log.d(TAG, "dispose")
        audioHandler.post {
          audioTrack?.release()
          audioTrack = null
        }
        audioThread.quitSafely()
        result.success(null)
      }
      else -> result.notImplemented()
    }
  }

  private fun ensureTrack() {
    if (audioTrack != null) return
    Log.d(TAG, "ensureTrack")

    val channelConfig = if (channels == 1) AudioFormat.CHANNEL_OUT_MONO else AudioFormat.CHANNEL_OUT_STEREO
    val format = AudioFormat.Builder()
      .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
      .setSampleRate(sampleRate)
      .setChannelMask(channelConfig)
      .build()

    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
      .build()

    val minBuffer = AudioTrack.getMinBufferSize(sampleRate, channelConfig, AudioFormat.ENCODING_PCM_16BIT)
    val bufferSize = (minBuffer * 2).coerceAtLeast(sampleRate / 2)

    try {
      audioTrack = AudioTrack(
        attrs,
        format,
        bufferSize,
        AudioTrack.MODE_STREAM,
        AudioManager.AUDIO_SESSION_ID_GENERATE
      )
      Log.d(TAG, "AudioTrack created")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to create AudioTrack", e)
    }
  }
}
