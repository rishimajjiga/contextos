package com.usecontextos.app.webview

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.webkit.JavascriptInterface
import com.usecontextos.app.BuildConfig
import com.usecontextos.app.util.Constants
import com.usecontextos.app.util.CrashLogger

/**
 * NOT purely additive: the frontend's `useBubbleExtension` hook (see
 * frontend/src/hooks/useBubbleExtension.ts) declares `isBubbleEnabled`/`enableBubble`/
 * `disableBubble` as part of this bridge's TypeScript interface and calls them unconditionally
 * from a `useEffect` the moment `isNativeApp()` is true — i.e. as soon as this class exists at
 * all, the other three methods are load-bearing. Omitting any of them throws an uncaught
 * TypeError inside that effect, which React 18 responds to by unmounting the whole root (no
 * error boundary wraps it) — this was the exact cause of the black screen on /sign-in and
 * /dashboard after login. Keep this bridge's method set in sync with that TS interface.
 */
class WebAppBridge(
    private val context: Context,
    // Last known MAIN-frame URL, supplied by the host Activity (volatile-read, thread-safe from
    // the JavaBridge thread — WebView.getUrl() itself is UI-thread-only and can't be used here).
    // Gates state-writing bridge calls to pages on our own hosts; a WebView that somehow ended
    // up elsewhere can't flip native state. Defaults to null (untrusted) for any host that
    // doesn't wire it.
    private val mainFrameUrl: () -> String? = { null },
) {

    private fun isOnTrustedPage(): Boolean {
        val host = mainFrameUrl()
            ?.let { runCatching { Uri.parse(it).host?.lowercase() }.getOrNull() }
            .orEmpty()
        return Constants.IN_APP_HOST_SUFFIXES.any { host == it || host.endsWith(".$it") }
    }

    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun getAppVersion(): String = BuildConfig.VERSION_NAME

    /**
     * Login persistence: the live Clerk signed-in state, reported by AUTH_STATE_SCRIPT on every
     * app-host page load. Persisted so the next cold start opens returning signed-in users on the
     * dashboard instead of the landing page (see MainActivity.onCreate / maybeSyncAuthState).
     */
    @JavascriptInterface
    fun onAuthState(signedIn: Boolean) {
        // Only the natively-injected AUTH_STATE_SCRIPT calls this, and only on app-host pages —
        // reject calls made while the main frame is anywhere else.
        if (!isOnTrustedPage()) return
        prefs.edit().putBoolean(Constants.PREF_WAS_SIGNED_IN, signedIn).apply()
    }

    // ---- Floating Brain system overlay (SYSTEM_ALERT_WINDOW) --------------------------------
    // "Self-heals" per the frontend's own doc comment: isBubbleEnabled() never trusts the stored
    // preference alone, because the OS can silently revoke "draw over other apps" from Settings
    // at any time without telling the app. Always AND it with the live permission check.

    private val prefs get() = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)

    @JavascriptInterface
    fun isBubbleEnabled(): Boolean =
        prefs.getBoolean(Constants.PREF_BUBBLE_ENABLED, false) && Settings.canDrawOverlays(context)

    @JavascriptInterface
    fun enableBubble(): String {
        if (Settings.canDrawOverlays(context)) {
            prefs.edit().putBoolean(Constants.PREF_BUBBLE_ENABLED, true).apply()
            androidx.core.content.ContextCompat.startForegroundService(
                context,
                Intent(context, com.usecontextos.app.bubble.FloatingBubbleService::class.java),
            )
            // Arm the periodic recovery safety net for as long as the bubble is on.
            com.usecontextos.app.bubble.BubbleHealthWorker.schedule(context)
            return "granted"
        }
        // Remember the user's intent so isBubbleEnabled() flips true the moment permission is
        // granted — BubbleSetupActivity starts the service itself once the user finishes.
        prefs.edit().putBoolean(Constants.PREF_BUBBLE_ENABLED, true).apply()
        context.startActivity(
            Intent(context, com.usecontextos.app.bubble.BubbleSetupActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
        return "permission_required"
    }

    @JavascriptInterface
    fun disableBubble() {
        prefs.edit().putBoolean(Constants.PREF_BUBBLE_ENABLED, false).apply()
        com.usecontextos.app.bubble.BubbleHealthWorker.cancel(context)
        context.stopService(Intent(context, com.usecontextos.app.bubble.FloatingBubbleService::class.java))
    }

    /**
     * "Restore Floating Brain" (requirement 10) — callable from the site's Settings page if a
     * button is added there (window.ContextOSNative.restoreBubble()). Verifies permission,
     * (re)starts the foreground service, re-arms the health worker, and reports back so the page
     * can show "Floating brain restored." or route to permission setup.
     */
    @JavascriptInterface
    fun restoreBubble(): String {
        if (!Settings.canDrawOverlays(context)) {
            prefs.edit().putBoolean(Constants.PREF_BUBBLE_ENABLED, true).apply()
            context.startActivity(
                Intent(context, com.usecontextos.app.bubble.BubbleSetupActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            return "permission_required"
        }
        prefs.edit().putBoolean(Constants.PREF_BUBBLE_ENABLED, true).apply()
        com.usecontextos.app.bubble.FloatingBubbleService.startIfEnabled(context)
        com.usecontextos.app.bubble.BubbleHealthWorker.schedule(context)
        return "restored"
    }

    // ---- Floating Brain panel auth (separate from the overlay permission above) -------------
    // See MainActivity.BUBBLE_AUTO_MINT_SCRIPT / BUBBLE_SIGNOUT_CHECK_SCRIPT — these are called
    // by natively-injected JS, not by any frontend source change.

    /** First call ever (no key stored yet) → this IS "first sign-in": show the one-time
     * onboarding bottom sheet. Subsequent calls (token refresh, app restart) just re-save. */
    /**
     * A credential-bearing bridge call may only point the native app at the real ContextOS backend.
     * The bridge is exposed to every frame in the WebView (including cross-origin iframes such as
     * ads), so without this an untrusted frame could redirect all native API traffic — and the
     * memories it carries — to an attacker's server. Requires HTTPS + a usecontextos.com host.
     */
    private fun isTrustedApiUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        return try {
            val uri = Uri.parse(url)
            val host = uri.host?.lowercase().orEmpty()
            uri.scheme?.lowercase() == "https" &&
                (host == "usecontextos.com" || host.endsWith(".usecontextos.com"))
        } catch (e: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun onBubbleKeyMinted(apiKey: String, apiUrl: String) {
        // SECURITY: this method is reachable from ANY frame in the WebView, including cross-origin
        // iframes (e.g. AdSense) — addJavascriptInterface injects the bridge into every frame. A
        // hostile frame could otherwise repoint the native API base URL at its own server and
        // exfiltrate everything the bubble/selection-save sends. Only ever accept a usecontextos.com
        // apiUrl, and a well-formed ctxos_ key. See isTrustedApiUrl().
        if (!isTrustedApiUrl(apiUrl) || !apiKey.startsWith("ctxos_")) {
            CrashLogger.e("Security", "Rejected onBubbleKeyMinted — untrusted apiUrl or malformed key")
            return
        }
        val isFirstTime = !com.usecontextos.app.bubble.data.BubbleCredentialStore.isSignedIn(context)
        com.usecontextos.app.bubble.data.BubbleCredentialStore.saveApiKey(context, apiKey, apiUrl)
        // We now hold a key — register this device's FCM token so per-user push can target it,
        // and kick off an immediate inbox poll (the Firebase-free notification path).
        com.usecontextos.app.fcm.PushRegistrar.registerIfPossible(context)
        com.usecontextos.app.fcm.NotificationPollWorker.pollNow(context)
        if (isFirstTime && !prefs.getBoolean(Constants.PREF_BUBBLE_ONBOARDING_SHOWN, false)) {
            prefs.edit().putBoolean(Constants.PREF_BUBBLE_ONBOARDING_SHOWN, true).apply()
            (context as? androidx.appcompat.app.AppCompatActivity)?.runOnUiThread {
                com.usecontextos.app.bubble.BubbleOnboardingSheet.showIfResumed(context)
            }
        }
    }

    @JavascriptInterface
    fun onBubbleSignedOut() {
        // Unregister BEFORE clearing the key — the unregister call needs it to authenticate.
        com.usecontextos.app.fcm.PushRegistrar.unregister(context)
        // Forget which inbox items we've seen, so the next account starts clean (see the poller).
        com.usecontextos.app.fcm.NotificationPollWorker.resetSeenState(context)
        com.usecontextos.app.bubble.data.BubbleCredentialStore.clear(context)
        prefs.edit().putBoolean(Constants.PREF_BUBBLE_ENABLED, false).apply()
        com.usecontextos.app.bubble.BubbleHealthWorker.cancel(context)
        context.stopService(Intent(context, com.usecontextos.app.bubble.FloatingBubbleService::class.java))
    }

    /**
     * The FCM token, once Firebase has delivered one. Native code already registers it with the
     * backend for per-user push (see PushRegistrar); this bridge stays for any site JS that wants
     * the raw token. If the cache is empty on first launch, kick off a fetch so a later call
     * succeeds.
     */
    @JavascriptInterface
    fun getFcmToken(): String {
        // Deliberately returns nothing. addJavascriptInterface exposes this to EVERY frame in the
        // WebView (including cross-origin iframes), no caller exists anywhere in the frontend or
        // extension (native code registers the token with the backend itself — see PushRegistrar),
        // and handing a device push token to arbitrary embedded frames is a needless leak. The
        // method stays so any legacy probe gets an empty string instead of a TypeError.
        return ""
    }

    /** Call when a Live Session starts presenting, so it survives the screen turning off. */
    @JavascriptInterface
    fun startLiveSessionForeground() {
        androidx.core.content.ContextCompat.startForegroundService(
            context,
            Intent(context, com.usecontextos.app.service.KeepAliveService::class.java),
        )
    }

    @JavascriptInterface
    fun stopLiveSessionForeground() {
        context.startService(
            Intent(context, com.usecontextos.app.service.KeepAliveService::class.java)
                .setAction(Constants.ACTION_STOP_LIVE_SESSION),
        )
    }

    @JavascriptInterface
    fun share(text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(Intent.createChooser(intent, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    @JavascriptInterface
    fun vibrate(milliseconds: Long) {
        // createOneShot throws IllegalArgumentException for durations <= 0, and this method is
        // callable by any page JS — clamp and guard so no argument can crash the bridge thread.
        val duration = milliseconds.coerceIn(1, 10_000)
        runCatching {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
        }
    }

    /**
     * Called by the key-extraction script injected into the main WebView when it
     * loads `/connect-extension` and detects `#key=ctxos_…` in the URL hash.
     * Stores the credentials in SharedPreferences so the popup WebView can read
     * them on its next open (see chrome-shim.js `getPendingCredentials` bridge).
     *
     * Also feeds the Floating Brain bubble's own credential store — this is the exact same
     * ctxos_ key shape the bubble needs (see ContextOSApi/BubbleCredentialStore), so the
     * Connect tab's "Connect with ContextOS" button reuses this already-working extraction
     * flow (tapping it just navigates here, see FloatingBubbleService.openApp) instead of
     * building a second, parallel OAuth path.
     */
    @JavascriptInterface
    fun onExtensionKeyExtracted(apiKey: String, apiUrl: String, frontendUrl: String) {
        // SECURITY: same cross-frame exposure as onBubbleKeyMinted — reject any apiUrl that isn't
        // usecontextos.com (and any non-ctxos_ key) so a hostile iframe can't hijack the native
        // credential to point at an attacker-controlled backend.
        if (!isTrustedApiUrl(apiUrl) || !apiKey.startsWith("ctxos_")) {
            CrashLogger.e("Security", "Rejected onExtensionKeyExtracted — untrusted apiUrl or malformed key")
            return
        }
        context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(Constants.PREF_EXT_API_KEY, apiKey)
            .putString(Constants.PREF_EXT_API_URL, apiUrl)
            .putString(Constants.PREF_EXT_FRONTEND_URL, frontendUrl)
            .apply()
        com.usecontextos.app.bubble.data.BubbleCredentialStore.saveApiKey(context, apiKey, apiUrl)
        // Same key the bubble uses → also enough to register for push and poll the inbox.
        com.usecontextos.app.fcm.PushRegistrar.registerIfPossible(context)
        com.usecontextos.app.fcm.NotificationPollWorker.pollNow(context)
    }
}

