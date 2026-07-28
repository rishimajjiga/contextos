package com.usecontextos.app.fcm

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.usecontextos.app.bubble.data.BubbleCredentialStore
import com.usecontextos.app.util.Constants
import com.usecontextos.app.util.CrashLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Firebase-free push. Instead of FCM, this WorkManager job periodically reads the user's existing
 * in-app notification inbox (GET /api/v1/inbox/notifications — the same endpoint the website's
 * NotificationBell uses) with the native ctxos_ API key, and posts a real Android notification for
 * every NEW unread item. No google-services.json, no Firebase service account — it reuses the
 * founder Notification system that already exists.
 *
 * Trade-offs vs. FCM (by design, since the user opted out of Firebase):
 *   - Not instant: WorkManager's minimum periodic interval is 15 minutes, and the OS may defer it
 *     further under Doze / battery optimisation, or not run it at all while the app is force-stopped.
 *   - It's polling, so it costs a small periodic network request.
 * For founder announcements (not time-critical) this is a fine trade for zero Firebase setup.
 *
 * De-dup: notification ids already surfaced are remembered in SharedPreferences so nothing repeats.
 * On the FIRST successful poll it SEEDS that set from whatever's already in the inbox WITHOUT
 * notifying, so installing the app doesn't fire a notification for every historical item.
 */
class NotificationPollWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val context = applicationContext
        val apiKey = BubbleCredentialStore.getApiKey(context)
        if (apiKey.isNullOrBlank()) return@withContext Result.success() // signed out — nothing to poll
        val base = BubbleCredentialStore.getApiUrl(context).trimEnd('/')

        try {
            val client = OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()
            val request = Request.Builder()
                .url("$base/api/v1/inbox/notifications")
                .header("X-Api-Key", apiKey)
                .get()
                .build()

            client.newCall(request).execute().use { res ->
                when {
                    res.code == 401 || res.code == 403 -> Result.success() // key not valid; don't retry-storm
                    !res.isSuccessful -> Result.retry()
                    else -> {
                        handleResponse(context, res.body?.string().orEmpty())
                        Result.success()
                    }
                }
            }
        } catch (e: Exception) {
            CrashLogger.e("NotifPoll", "poll failed", e)
            Result.retry()
        }
    }

    private fun handleResponse(context: Context, body: String) {
        if (body.isBlank()) return
        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        val seen = prefs.getStringSet(Constants.PREF_SEEN_NOTIFICATION_IDS, emptySet())
            ?.toMutableSet() ?: mutableSetOf()
        val seeded = prefs.getBoolean(Constants.PREF_NOTIFICATION_POLL_SEEDED, false)

        val items = JSONObject(body).optJSONArray("notifications") ?: return
        val currentIds = mutableSetOf<String>()
        val toNotify = mutableListOf<JSONObject>()
        for (i in 0 until items.length()) {
            val n = items.optJSONObject(i) ?: continue
            val id = n.optString("id")
            if (id.isBlank()) continue
            currentIds.add(id)
            val read = n.optBoolean("read", false)
            if (!read && !seen.contains(id)) toNotify.add(n)
        }

        // First run ever: remember what's already there, but don't notify for it.
        if (!seeded) {
            seen.addAll(currentIds)
            prefs.edit()
                .putStringSet(Constants.PREF_SEEN_NOTIFICATION_IDS, seen)
                .putBoolean(Constants.PREF_NOTIFICATION_POLL_SEEDED, true)
                .apply()
            return
        }

        for (n in toNotify) {
            val id = n.optString("id")
            NotificationHelper.show(
                context,
                title = n.optString("title", "ContextOS").ifBlank { "ContextOS" },
                body = n.optString("message", ""),
                deepLinkUrl = DEEP_LINK,
                stableId = id.hashCode(),
            )
            seen.add(id)
        }

        // Keep the seen-set bounded so it can't grow without limit over the app's lifetime.
        val bounded = if (seen.size > MAX_SEEN) seen.toList().takeLast(MAX_SEEN).toSet() else seen
        prefs.edit().putStringSet(Constants.PREF_SEEN_NOTIFICATION_IDS, bounded).apply()
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "contextos_notification_poll"
        private const val DEEP_LINK = "https://www.usecontextos.com/dashboard"
        private const val MAX_SEEN = 300

        /** Periodic 15-min poll (WorkManager's floor). Idempotent — KEEP won't reschedule if it's
         *  already enqueued. Safe to call on every app start. */
        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<NotificationPollWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.LINEAR, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }

        /** A one-off immediate poll — e.g. right after sign-in, so the user isn't waiting up to
         *  15 minutes for the first periodic tick. */
        fun pollNow(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = OneTimeWorkRequestBuilder<NotificationPollWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context).enqueue(request)
        }

        /** On sign-out: forget the seen-state so the next account (or next sign-in) re-seeds from a
         *  clean slate instead of inheriting this user's already-seen ids. */
        fun resetSeenState(context: Context) {
            context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(Constants.PREF_SEEN_NOTIFICATION_IDS)
                .remove(Constants.PREF_NOTIFICATION_POLL_SEEDED)
                .apply()
        }
    }
}
