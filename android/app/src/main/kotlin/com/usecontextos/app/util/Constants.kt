package com.usecontextos.app.util

import com.usecontextos.app.BuildConfig

object Constants {
    /** The site itself — always loaded inside the app's WebView. */
    val BASE_URL: String = BuildConfig.BASE_URL
    val APP_HOST: String = BuildConfig.APP_HOST

    /**
     * Hosts that are first-party enough to render inside the WebView.
     * Everything else (Google/GitHub OAuth, Stripe Checkout, WhatsApp, docs, etc.)
     * is handed off to Chrome Custom Tabs — required because Google blocks its
     * OAuth consent screen from loading inside embedded WebViews.
     */
    val IN_APP_HOST_SUFFIXES = listOf(
        "usecontextos.com",
        "clerk.accounts.dev",
        "clerk.com",
        "clerk.dev",
    )

    /**
     * The app's own origin only — deliberately excludes the Clerk hosts above. Used solely to
     * decide when the OAuth popup (see AppWebChromeClient.onCreateWindow) has finished and
     * control should hand back to the parent WebView. Clerk's own domain is where the OAuth
     * callback actually completes the handshake (validates state, sets the session cookie) —
     * that needs to run as a normal page load inside the popup, not get yanked into a raw
     * loadUrl() on the parent. Handing off too early there sends a bare top-level GET to what
     * is effectively a Clerk API endpoint, which Clerk correctly rejects as unauthorized since
     * it's missing the context Clerk's own JS would have attached.
     */
    val APP_ORIGIN_SUFFIXES = listOf("usecontextos.com")

    /**
     * Hosts for OAuth providers Clerk can redirect to. Google (and, if ever enabled, GitHub/
     * Apple) refuse to render their sign-in screens inside any embedded WebView, so navigation
     * to these hosts is intercepted and restarted as the *entire* sign-in flow inside a Custom
     * Tab (see AppWebViewClient.openInCustomTab) rather than just handing off this one hop —
     * otherwise the rest of Clerk's handshake is stranded in a browsing context (Chrome) that
     * doesn't share cookies with this app's WebView, which is what originally broke this.
     */
    val OAUTH_PROVIDER_HOSTS = setOf(
        "accounts.google.com",
        "github.com",
        "appleid.apple.com",
    )

    const val ACTION_STOP_LIVE_SESSION = "com.usecontextos.app.action.STOP_LIVE_SESSION"
    const val ACTION_OPEN_LIVE_SESSION = "com.usecontextos.app.action.OPEN_LIVE_SESSION"
    const val EXTRA_TARGET_URL = "extra_target_url"

    const val PREFS_NAME = "contextos_prefs"

    // Whether the user wants the Floating Brain overlay on — see WebAppBridge.isBubbleEnabled(),
    // which ANDs this with the live SYSTEM_ALERT_WINDOW permission state rather than trusting it alone.
    const val PREF_BUBBLE_ENABLED = "bubble_enabled"

    // Shown once, the first time a Clerk session is detected on this device — see
    // WebAppBridge.onBubbleKeyMinted() and bubble/BubbleOnboardingSheet.kt.
    const val PREF_BUBBLE_ONBOARDING_SHOWN = "bubble_onboarding_shown"

    // Login persistence: the last known Clerk auth state, kept current by AUTH_STATE_SCRIPT ->
    // WebAppBridge.onAuthState(). Read on cold start (MainActivity.onCreate) to open returning
    // signed-in users straight on /dashboard instead of the landing page.
    const val PREF_WAS_SIGNED_IN = "was_signed_in"

    // Extension connect-flow credentials — written by the main WebView after the user
    // completes OAuth on /connect-extension, read by the popup WebView on next open.
    const val PREF_EXT_API_KEY = "ext_pending_api_key"
    const val PREF_EXT_API_URL = "ext_pending_api_url"
    const val PREF_EXT_FRONTEND_URL = "ext_pending_frontend_url"

    // Push notifications: a de-dup marker (hash of the last successfully-registered
    // FCM-token + API-key pair) so PushRegistrar doesn't re-POST /devices/register on
    // every screen load — see fcm/PushRegistrar.kt.
    const val PREF_LAST_DEVICE_REG = "last_device_registration"

    // Firebase-free notifications: NotificationPollWorker polls /inbox/notifications and posts a
    // device notification for each NEW unread item. These track which notification ids have
    // already been surfaced (so nothing repeats) and whether the very first poll has seeded that
    // set (so a fresh install doesn't blast a notification for every pre-existing item).
    const val PREF_SEEN_NOTIFICATION_IDS = "seen_notification_ids"
    const val PREF_NOTIFICATION_POLL_SEEDED = "notification_poll_seeded"
}
