package com.usecontextos.app.connectivity

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.firebase.messaging.FirebaseMessaging
import com.usecontextos.app.bubble.BubbleHealthWorker
import com.usecontextos.app.bubble.FloatingBubbleService
import com.usecontextos.app.fcm.ContextOSFirebaseMessagingService
import com.usecontextos.app.util.CrashLogger

/**
 * Restores the Floating Brain bubble after the two events that tear the running service down
 * without the user's intent:
 *   - BOOT_COMPLETED — device restart (requirement 4)
 *   - MY_PACKAGE_REPLACED — the app was updated, e.g. from the Play Store (requirement 5)
 * A plain Service doesn't survive either on its own. Also re-confirms the FCM topic subscription
 * after a reboot.
 *
 * Only restarts what the user explicitly turned on (PREF_BUBBLE_ENABLED, set solely via
 * WebAppBridge.enableBubble) and only with live overlay permission — never unconditionally.
 * FloatingBubbleService.startIfEnabled encapsulates that check, and re-arms the periodic health
 * worker so the safety net is running again too.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> {
                CrashLogger.d("Bubble", "BOOT_COMPLETED — restoring bubble if enabled")
                // Guarded: an exception inside a boot receiver would crash the app at every
                // device restart, and with the placeholder google-services.json this call can
                // only fail. runCatching keeps even an unexpected Firebase init problem from
                // ever taking the boot path down with it.
                if (com.usecontextos.app.fcm.PushRegistrar.isFirebaseConfigured(context)) {
                    runCatching {
                        FirebaseMessaging.getInstance().subscribeToTopic(ContextOSFirebaseMessagingService.TOPIC_ALL_USERS)
                    }
                }
                restoreBubble(context)
            }
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                CrashLogger.d("Bubble", "MY_PACKAGE_REPLACED (app updated) — restoring bubble if enabled")
                restoreBubble(context)
            }
        }
    }

    private fun restoreBubble(context: Context) {
        if (FloatingBubbleService.startIfEnabled(context)) {
            BubbleHealthWorker.schedule(context)
        }
    }
}
