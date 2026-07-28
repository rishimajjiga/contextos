package com.usecontextos.app.service

import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.usecontextos.app.MainActivity
import com.usecontextos.app.R
import com.usecontextos.app.util.Constants

/**
 * Deliberately narrow: this foreground service exists ONLY to keep a Live Session's realtime
 * connection (Supabase Realtime, driven entirely by the site's own JS) alive while the screen
 * is off or the app is backgrounded during an active presentation — the one case in this app
 * where "the work should keep running while backgrounded" is genuinely true.
 *
 * It is user-initiated (started from ContextOSNative.startLiveSessionForeground(), called by
 * the site's own Live Session JS when presenting starts) and always shows an ongoing
 * notification with a Stop action, per Play Store foreground-service policy. It must NOT be
 * started unconditionally at app launch or on boot — that would be a policy violation for a
 * WebView content app with no inherent need to run in the background.
 */
class KeepAliveService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == Constants.ACTION_STOP_LIVE_SESSION) {
            stopSelf()
            return START_NOT_STICKY
        }

        // Same contract as FloatingBubbleService: on Android 12+ a foreground start attempted
        // while the app isn't in the foreground throws ForegroundServiceStartNotAllowedException,
        // and an uncaught throw here takes the whole app down. The bridge only calls this from a
        // resumed Activity, but the site's JS drives that call — never trust the timing.
        try {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } catch (e: Exception) {
            com.usecontextos.app.util.CrashLogger.e("KeepAlive", "startForeground failed — stopping safely", e)
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun buildNotification(): android.app.Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this,
            0,
            Intent(this, KeepAliveService::class.java).setAction(Constants.ACTION_STOP_LIVE_SESSION),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, getString(R.string.live_session_channel_id))
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(getColor(R.color.brand_green))
            .setContentTitle(getString(R.string.live_session_notification_title))
            .setContentText(getString(R.string.live_session_notification_text))
            .setOngoing(true)
            .setContentIntent(openIntent)
            .addAction(0, getString(R.string.action_open), openIntent)
            .addAction(0, getString(R.string.action_stop), stopIntent)
            .build()
    }

    companion object {
        private const val NOTIFICATION_ID = 42
    }
}
