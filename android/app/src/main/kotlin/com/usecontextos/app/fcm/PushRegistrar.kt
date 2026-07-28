package com.usecontextos.app.fcm

import android.content.Context
import android.os.Build
import com.google.firebase.messaging.FirebaseMessaging
import com.usecontextos.app.bubble.data.BubbleCredentialStore
import com.usecontextos.app.util.Constants
import com.usecontextos.app.util.CrashLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Registers this device's FCM token with the ContextOS backend so a founder notification can
 * target it (POST /api/v1/devices/register), and de-registers it on sign-out. This is the piece
 * that turns "the app receives a broadcast to a topic" into "the backend can push to THIS user".
 *
 * It authenticates the same way the bubble/selection features already do — the native ctxos_ API
 * key in the X-Api-Key header (see [BubbleCredentialStore] / ContextOSApi) — so there is no Clerk
 * session juggling and no website change: whenever the app has a key AND a token, it registers.
 *
 * Triggered from three places so registration is never missed:
 *   - the moment a key is minted/extracted (WebAppBridge) — "signed in, now register",
 *   - when FCM rotates the token (ContextOSFirebaseMessagingService.onNewToken),
 *   - on every cold start (MainActivity) — a cheap no-op when nothing changed (de-duped below).
 * Every call is best-effort and off the main thread; failures are logged, never thrown.
 */
object PushRegistrar {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    /** Fetch + cache the FCM token so getFcmToken()/unregister have it, without requiring the
     *  user to be signed in. Cheap and safe to call on every app start. */
    fun ensureTokenCached(context: Context) {
        val appContext = context.applicationContext
        scope.launch { runCatching { currentToken(appContext) } }
    }

    /** Register the current FCM token if we have both a token and an API key. De-duped so it
     *  won't re-POST when nothing changed since the last successful registration. */
    fun registerIfPossible(context: Context) {
        val appContext = context.applicationContext
        scope.launch {
            runCatching { registerBlocking(appContext) }
                .onFailure { CrashLogger.e("Push", "registerIfPossible failed", it) }
        }
    }

    private suspend fun registerBlocking(context: Context) {
        val apiKey = BubbleCredentialStore.getApiKey(context)
        if (apiKey.isNullOrBlank()) return   // not signed in yet — nothing to register against
        val token = currentToken(context) ?: return
        val base = BubbleCredentialStore.getApiUrl(context).trimEnd('/')

        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        val marker = "$token|$apiKey".hashCode().toString()
        if (prefs.getString(Constants.PREF_LAST_DEVICE_REG, null) == marker) return

        val payload = JSONObject()
            .put("token", token)
            .put("platform", "android")
            .put("device_name", "${Build.MANUFACTURER} ${Build.MODEL}".take(120))

        val request = Request.Builder()
            .url("$base/api/v1/devices/register")
            .header("X-Api-Key", apiKey)
            .header("Content-Type", "application/json")
            .post(payload.toString().toRequestBody(jsonMedia))
            .build()

        client.newCall(request).execute().use { res ->
            if (res.isSuccessful) {
                prefs.edit().putString(Constants.PREF_LAST_DEVICE_REG, marker).apply()
                CrashLogger.d("Push", "Device token registered with backend")
            } else {
                CrashLogger.e("Push", "Device register failed: HTTP ${res.code}")
            }
        }
    }

    /**
     * De-register on sign-out. Reads the key/URL/token SYNCHRONOUSLY (before the caller clears the
     * credential store) so the unregister call can still authenticate, then does the network work
     * off-thread. Safe to call even if nothing is registered.
     */
    fun unregister(context: Context) {
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        val apiKey = BubbleCredentialStore.getApiKey(appContext)
        val token = prefs.getString(ContextOSFirebaseMessagingService.PREF_FCM_TOKEN, null)
        val base = BubbleCredentialStore.getApiUrl(appContext).trimEnd('/')
        // Clear the de-dup marker regardless, so the next sign-in always re-registers.
        prefs.edit().remove(Constants.PREF_LAST_DEVICE_REG).apply()
        if (apiKey.isNullOrBlank() || token.isNullOrBlank()) return

        scope.launch {
            runCatching {
                val payload = JSONObject().put("token", token)
                val request = Request.Builder()
                    .url("$base/api/v1/devices/unregister")
                    .header("X-Api-Key", apiKey)
                    .header("Content-Type", "application/json")
                    .post(payload.toString().toRequestBody(jsonMedia))
                    .build()
                client.newCall(request).execute().use { res ->
                    CrashLogger.d("Push", "Device unregister: HTTP ${res.code}")
                }
            }.onFailure { CrashLogger.e("Push", "unregister failed", it) }
        }
    }

    // Logged at most once per process — this is a build-configuration fact, not a runtime event,
    // and the old per-call stack trace drowned out real logs on every single app start.
    @Volatile
    private var warnedUnconfigured = false

    /** True only when a REAL google-services.json is baked in. The repo ships a placeholder
     *  (api_key "REPLACE_WITH_..."), with which every FirebaseMessaging call is guaranteed to
     *  throw ("Please set a valid API key") — so don't make the call at all. Real Google API keys
     *  always start with "AIza"; this mirrors Firebase's own precondition check. Push silently
     *  stays off and NotificationPollWorker remains the delivery path until the real file ships.
     *  Shared by every FCM call site (BootReceiver, BackgroundSyncWorker) for the same reason. */
    fun isFirebaseConfigured(context: Context): Boolean {
        val configured = runCatching {
            com.google.firebase.FirebaseApp.getApps(context).isNotEmpty() &&
                com.google.firebase.FirebaseApp.getInstance().options.apiKey.startsWith("AIza")
        }.getOrDefault(false)
        if (!configured && !warnedUnconfigured) {
            warnedUnconfigured = true
            CrashLogger.d("Push", "Firebase not configured (placeholder google-services.json) — FCM disabled, inbox polling remains active")
        }
        return configured
    }

    /** The live FCM token (also cached to prefs so getFcmToken()/unregister see it), falling back
     *  to the last cached value if Firebase can't produce one right now. */
    private suspend fun currentToken(context: Context): String? {
        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        val cached = prefs.getString(ContextOSFirebaseMessagingService.PREF_FCM_TOKEN, null)
        if (!isFirebaseConfigured(context)) return cached
        return try {
            val fresh = FirebaseMessaging.getInstance().token.await()
            if (!fresh.isNullOrBlank()) {
                prefs.edit().putString(ContextOSFirebaseMessagingService.PREF_FCM_TOKEN, fresh).apply()
                fresh
            } else cached
        } catch (e: Exception) {
            // No Google Play services / offline — use the cache.
            CrashLogger.e("Push", "FirebaseMessaging.token unavailable", e)
            cached
        }
    }
}
