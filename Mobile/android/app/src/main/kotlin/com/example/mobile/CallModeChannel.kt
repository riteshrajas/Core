package com.example.mobile

import android.app.Activity
import android.content.Context
import android.media.AudioManager
import android.os.PowerManager
import android.view.WindowManager
import androidx.annotation.NonNull
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import io.flutter.plugin.common.MethodChannel.Result
import android.util.Log

class CallModeChannel(
  flutterEngine: FlutterEngine,
  private val activity: Activity,
) : MethodCallHandler {
  private val TAG = "ApexCallMode"
  private val channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "apex/call_mode")
  private val audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val powerManager = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
  private var wakeLock: PowerManager.WakeLock? = null

  init {
    channel.setMethodCallHandler(this)
  }

  override fun onMethodCall(@NonNull call: MethodCall, @NonNull result: Result) {
    Log.d(TAG, "onMethodCall: ${call.method}")
    when (call.method) {
      "enable" -> {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        try {
          audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
          audioManager.isSpeakerphoneOn = false
          
          if (wakeLock == null) {
              try {
                  wakeLock = powerManager.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "apex:proximity_lock")
                  wakeLock?.acquire()
                  Log.d(TAG, "Proximity wake lock acquired")
              } catch (e: Exception) {
                  Log.e(TAG, "Failed to acquire proximity wake lock", e)
              }
          }
        } catch (e: Exception) {
          Log.e(TAG, "Failed to enable call mode", e)
        }
        result.success(null)
      }
      "disable" -> {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        try {
          audioManager.mode = AudioManager.MODE_NORMAL
          audioManager.isSpeakerphoneOn = false
          wakeLock?.let {
            if (it.isHeld) it.release()
            Log.d(TAG, "Proximity wake lock released")
          }
          wakeLock = null
        } catch (e: Exception) {
          Log.e(TAG, "Failed to disable call mode", e)
        }
        result.success(null)
      }
      "setSpeakerphoneOn" -> {
        val on = call.arguments as? Boolean ?: false
        Log.d(TAG, "setSpeakerphoneOn: $on")
        try {
          audioManager.isSpeakerphoneOn = on
        } catch (e: Exception) {
          Log.e(TAG, "Failed to set speakerphone", e)
        }
        result.success(null)
      }
      else -> result.notImplemented()
    }
  }
}
