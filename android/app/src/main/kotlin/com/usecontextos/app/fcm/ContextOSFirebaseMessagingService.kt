package com.usecontextos.app.fcm

import android.content.Context
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.usecontextos.app.util.Constants

/**
 * Requires a real `google-services.json` from your Firebase project (see android/README.md) —
 * the one checked into this scaffold is a structurally-valid placeholder so the project
 * compiles, but it cannot receive real messages until you swap it out.
 *
 * Targeting is BOTH per-user and broadcast:
 *   - Per-user: onNewToken (and PushRegistrar, called on sign-in / app start) registers this
 *     token with the backend (POST /api/v1/devices/register, authed with the native ctxos_ key),
 *     so the Founder Panel's "send notification" can push to a specific user/plan/audience.
 *   - Broadcast: every install also subscribes to the "all_users" topic, so a plain Firebase
 *     console / Admin SDK topic message still reaches everyone with no backend involved.
 *
 * The backend sends data-only payloads (not "notification") so onMessageReceived runs in the
 * foreground, the background, AND when the app process is killed (not force-stopped) — see
 * push_service.py. That's what lets every push render through our own channel/icon/deep-link:
 *   { "data": { "title": "...", "body": "...", "url": "https://www.usecontextos.com/..." } }
 */
class ContextOSFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.data["title"] ?: message.notification?.title
        val body = message.data["body"] ?: message.notification?.body
        val url = message.data["url"]
        val notificationId = message.data["notification_id"]

        NotificationHelper.show(this, title, body, url, stableId = notificationId?.hashCode())

        // If this push and the inbox poller ever both run (i.e. Firebase gets configured later),
        // record the id here so NotificationPollWorker won't surface the same item a second time.
        if (!notificationId.isNullOrBlank()) {
            val prefs = getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
            val seen = prefs.getStringSet(Constants.PREF_SEEN_NOTIFICATION_IDS, emptySet())
                ?.toMutableSet() ?: mutableSetOf()
            seen.add(notificationId)
            prefs.edit().putStringSet(Constants.PREF_SEEN_NOTIFICATION_IDS, seen).apply()
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)

        getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_FCM_TOKEN, token)
            .apply()

        com.google.firebase.messaging.FirebaseMessaging.getInstance().subscribeToTopic(TOPIC_ALL_USERS)

        // Token rotated — push the new one to the backend so per-user targeting keeps working.
        // No-op if the user isn't signed in yet (no API key); PushRegistrar re-runs on sign-in.
        PushRegistrar.registerIfPossible(this)
    }

    companion object {
        const val TOPIC_ALL_USERS = "all_users"
        const val PREF_FCM_TOKEN = "fcm_token"
    }
}
