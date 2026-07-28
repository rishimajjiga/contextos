package com.usecontextos.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.webkit.WebView
import com.usecontextos.app.service.BackgroundSyncWorker
import com.usecontextos.app.util.CrashLogger

class ContextOSApp : Application() {

    override fun onCreate() {
        super.onCreate()
        // As early as possible, before anything else can throw.
        CrashLogger.install(this)

        // Debug builds only — lets `chrome://inspect` attach to the WebView over USB so
        // console errors, network requests, and the DOM can be inspected directly. Explicitly
        // OFF in release so a production WebView is never remotely inspectable.
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        } else {
            WebView.setWebContentsDebuggingEnabled(false)
        }
        // Neither of these needs to finish before the first frame draws — notification
        // channels only need to exist before something actually posts a notification, and
        // WorkManager scheduling is fire-and-forget. Off the main thread so they can't add
        // to the visible cold-start delay (most of which is WebView engine init + the real
        // network fetch of the live site, not startup code — that part isn't fixable here).
        Thread {
            createNotificationChannels()
            BackgroundSyncWorker.schedule(this)
            // Firebase-free notifications: periodically check the inbox and surface new unread
            // items as device notifications (no-op until signed in). See NotificationPollWorker.
            com.usecontextos.app.fcm.NotificationPollWorker.schedule(this)
        }.start()
    }

    private fun createNotificationChannels() {
        val manager = getSystemService(NotificationManager::class.java)

        manager.createNotificationChannel(
            NotificationChannel(
                getString(R.string.default_notification_channel_id),
                getString(R.string.default_notification_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT,
            )
        )

        manager.createNotificationChannel(
            NotificationChannel(
                getString(R.string.live_session_channel_id),
                getString(R.string.live_session_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Shows while a ContextOS Live Session is being presented"
            }
        )

        manager.createNotificationChannel(
            NotificationChannel(
                getString(R.string.bubble_channel_id),
                getString(R.string.bubble_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Shows while the Floating Brain bubble is active"
            }
        )
    }
}
