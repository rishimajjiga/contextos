package com.usecontextos.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.widget.Toast
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.launch
import com.usecontextos.app.capture.CaptureRepository
import com.usecontextos.app.capture.ShareIntentCaptureSource
import com.usecontextos.app.databinding.ActivityMainBinding
import com.usecontextos.app.util.Constants
import com.usecontextos.app.util.CrashLogger
import com.usecontextos.app.util.NetworkUtils
import com.usecontextos.app.webview.AppWebChromeClient
import com.usecontextos.app.webview.AppWebViewClient
import com.usecontextos.app.webview.DownloadHelper
import com.usecontextos.app.webview.WebAppBridge
import com.usecontextos.app.webview.WebViewHost

class MainActivity : AppCompatActivity(), WebViewHost {

    private lateinit var binding: ActivityMainBinding
    private var lastFailedUrl: String? = null

    // Last MAIN-frame URL, kept current by onPageStarted/onPageFinished below. Read (volatile)
    // from the WebAppBridge's JavaBridge thread to gate state-writing bridge calls — see
    // WebAppBridge.isOnTrustedPage(). WebView.getUrl() is UI-thread-only, hence this shadow copy.
    @Volatile
    private var lastMainFrameUrl: String? = null

    // True from a main-frame load error until the next navigation STARTS. Load-bearing for the
    // native error UX: after onReceivedError, Chromium still commits its own "Web page not
    // available" page and fires onPageFinished for it — without this flag that onPageFinished
    // called hideOffline() and unmasked the stock error page (the exact raw-browser screen the
    // native offline UI exists to replace).
    private var mainFrameErrored = false

    private var pendingFileCallback: ((Array<Uri>) -> Unit)? = null
    private var pendingPermissionResult: ((Boolean) -> Unit)? = null

    // Watchdog for page loads that neither finish nor raise onReceivedError — e.g. the
    // server accepts the connection but never responds, or a proxy/DNS layer silently
    // black-holes the request. Without this, onPageStarted's loading indicator would
    // spin forever with no path to the offline/retry screen (see showOffline()).
    private val watchdogHandler = Handler(Looper.getMainLooper())
    private var watchdogRunnable: Runnable? = null

    private fun startPageLoadWatchdog(url: String?) {
        cancelPageLoadWatchdog()
        val runnable = Runnable {
            CrashLogger.e("Navigation", "Page load watchdog fired — no onPageFinished/onReceivedError within ${PAGE_LOAD_TIMEOUT_MS}ms for $url")
            binding.swipeRefresh.isRefreshing = false
            lastFailedUrl = url
            showOffline()
        }
        watchdogRunnable = runnable
        watchdogHandler.postDelayed(runnable, PAGE_LOAD_TIMEOUT_MS)
    }

    private fun cancelPageLoadWatchdog() {
        watchdogRunnable?.let(watchdogHandler::removeCallbacks)
        watchdogRunnable = null
    }

    // Catches the failure mode the watchdog and onReceivedError both miss: the server
    // responds fine (HTTP 200, onPageFinished fires, no SSL/network error) but the page
    // never actually paints anything — e.g. an uncaught JS exception during React mount,
    // or a WebView-only API gap tripping up a library that works fine in Chrome. Without
    // this, that failure mode is a permanent black screen with no way back except
    // force-closing the app. Only runs for the app's own pages (see host check in the
    // caller) — Clerk/auth hops through other in-app hosts have no #root to check.
    private var renderCheckRunnable: Runnable? = null

    private fun startRenderCheck(url: String?) {
        cancelRenderCheck()
        val host = url?.let { Uri.parse(it).host?.lowercase() }
        if (host != Constants.APP_HOST) return
        val runnable = Runnable { verifyPageRendered(url) }
        renderCheckRunnable = runnable
        watchdogHandler.postDelayed(runnable, RENDER_CHECK_DELAY_MS)
    }

    private fun cancelRenderCheck() {
        renderCheckRunnable?.let(watchdogHandler::removeCallbacks)
        renderCheckRunnable = null
    }

    private fun verifyPageRendered(url: String?) {
        if (isDestroyed || isFinishing) return
        binding.webView.evaluateJavascript(RENDER_CHECK_SCRIPT) { result ->
            if (result != "true") {
                CrashLogger.e(
                    "Navigation",
                    "Render check failed for $url — #root has no visible content ${RENDER_CHECK_DELAY_MS}ms after onPageFinished",
                )
                lastFailedUrl = url
                showPageError()
            }
        }
    }

    private val connectivityManager by lazy {
        getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    }

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            runOnUiThread { onConnectivityChanged(true) }
        }

        override fun onLost(network: Network) {
            runOnUiThread { onConnectivityChanged(false) }
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        pendingFileCallback?.invoke(uris ?: emptyArray())
        pendingFileCallback = null
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        pendingPermissionResult?.invoke(results.values.all { it })
        pendingPermissionResult = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        CrashLogger.d("Lifecycle", "onCreate — savedInstanceState=${savedInstanceState != null}")
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Android 16 (targetSdk 36) enforces edge-to-edge with no opt-out — decor-fitting is
        // ignored there, which would draw the WebView underneath the status/navigation bars.
        // Going edge-to-edge explicitly and applying the bar insets as root padding reproduces
        // the old decor-fit layout identically on EVERY Android version, and the IME inset in
        // the bottom edge keeps the keyboard resizing behavior adjustResize used to provide.
        // Fullscreen video still works: enterFullscreen() hides the system bars, the insets
        // callback re-fires with zero bar insets, and the padding collapses to true fullscreen.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }

        setUpWebView()
        setUpSwipeRefresh()
        setUpBackNavigation()
        binding.offlineRetryButton.setOnClickListener { retryLoad() }
        requestNotificationPermission()
        // Push: make sure the FCM token is cached, and register it with the backend if the user
        // is already signed in (no-op otherwise). Off the main thread inside PushRegistrar.
        com.usecontextos.app.fcm.PushRegistrar.ensureTokenCached(this)
        com.usecontextos.app.fcm.PushRegistrar.registerIfPossible(this)
        // Developer-only: never surfaced to users in a release build.
        if (BuildConfig.DEBUG) maybeShowLastCrash()

        // Only the cold-start intent should pick an initial URL other than the homepage —
        // handleIntent() itself calls webView.loadUrl() when there's something actionable.
        if (!handleIntent(intent)) {
            // Login persistence: open returning-signed-in users straight on the dashboard instead
            // of the landing page. PREF_WAS_SIGNED_IN is kept accurate by AUTH_STATE_SCRIPT on
            // every app-host load (true once a Clerk session is seen, false when it's gone), so
            // this reflects the last known auth state across app restarts. If the flag is stale
            // (session expired since), /dashboard is a ProtectedRoute and the site bounces to
            // sign-in — and AUTH_STATE_SCRIPT then flips the flag back off. Genuinely signed-out
            // users start on the landing page as before.
            val wasSignedIn = getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(Constants.PREF_WAS_SIGNED_IN, false)
            val startUrl = if (wasSignedIn) Constants.BASE_URL.trimEnd('/') + "/dashboard" else Constants.BASE_URL
            CrashLogger.d("Navigation", "Cold start — wasSignedIn=$wasSignedIn — loading $startUrl")
            binding.webView.loadUrl(startUrl)
        }
    }

    // DEBUG BUILDS ONLY (gated at the call site) — a developer aid that shows a copyable dialog of
    // the previous run's FATAL crash log. Never runs in release, so users never see it. Scoped to
    // FATAL only now that the post-sign-in freeze it once tracked is resolved, so it doesn't pop
    // for ordinary debug logs even during development.
    private fun maybeShowLastCrash() {
        val log = CrashLogger.readLog(this)
        if (log.isBlank()) return
        CrashLogger.clearLog(this)
        if (!log.contains("FATAL")) return
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Crash log from last run")
            .setMessage(log.takeLast(4000))
            .setPositiveButton("Copy") { _, _ ->
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("ContextOS debug log", log))
                Toast.makeText(this, "Copied to clipboard", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Dismiss", null)
            .show()
    }

    private fun requestNotificationPermission() {
        // POST_NOTIFICATIONS only exists on API 33+; below that the OS doesn't know the
        // permission, checkSelfPermission reports it denied, and the launch is a pointless
        // instantly-denied round trip on every cold start.
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU) return
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    // ---- WebView setup ---------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUpWebView() {
        val webView = binding.webView
        val settings = webView.settings

        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.setSupportMultipleWindows(true)
        settings.javaScriptCanOpenWindowsAutomatically = true
        // Geolocation off — the app declares no location permission and the web app never uses it.
        settings.setGeolocationEnabled(false)
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.userAgentString = "${settings.userAgentString} ContextOSApp/${BuildConfig.VERSION_NAME}"

        val isNightMode = (resources.configuration.uiMode and
            android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
            android.content.res.Configuration.UI_MODE_NIGHT_YES

        // A freshly-created WebView has no backing content yet, and algorithmic darkening
        // (enabled below in dark mode) makes its default canvas solid black rather than
        // white until the page's own CSS paints over it. On a slow load — or one that never
        // completes — that black canvas is exactly what's on screen: this is the literal
        // "black screen" failure mode, distinct from the auth/session issues below. Setting
        // an explicit, theme-matched background guarantees there's never a black frame.
        binding.webView.setBackgroundColor(
            ContextCompat.getColor(this, if (isNightMode) R.color.background_dark else R.color.background_light)
        )

        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, isNightMode)
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = AppWebViewClient(
            context = this,
            onPageStarted = { url ->
                CrashLogger.d("Navigation", "onPageStarted: $url")
                lastMainFrameUrl = url
                binding.loadingProgress.visibility = View.VISIBLE
                lastFailedUrl = null
                mainFrameErrored = false
                startPageLoadWatchdog(url)
                cancelRenderCheck()
            },
            onPageFinished = { url ->
                CrashLogger.d("Navigation", "onPageFinished: $url")
                lastMainFrameUrl = url
                cancelPageLoadWatchdog()
                binding.loadingProgress.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
                if (mainFrameErrored) {
                    // This "finish" is Chromium committing its own error page for the load that
                    // just failed — the WebView has no usable content. Keep the native error
                    // screen up; hiding it here is what exposed the raw "Web page not available"
                    // browser page. Nothing below (auth sync, render check) applies to it either.
                    return@AppWebViewClient
                }
                // A load can finish successfully after the watchdog already switched to the
                // offline screen (e.g. a slow response that completes just past the timeout).
                hideOffline()
                maybeExtractExtensionKey(url)
                maybeSyncBubbleAuth(url)
                maybeSyncAuthState(url)
                // Cookies set during this load (e.g. Clerk's session cookie right after
                // login) are committed to disk immediately rather than waiting for onStop,
                // so a session survives even if the process is killed right after sign-in.
                CookieManager.getInstance().flush()
                if (url != null && url.contains("/dashboard")) {
                    CrashLogger.d("Navigation", "Dashboard route reached")
                }
                startRenderCheck(url)
            },
            onLoadError = { errorCode, description, failingUrl ->
                CrashLogger.e("Navigation", "onLoadError: code=$errorCode desc=$description url=$failingUrl")
                // ERROR_UNKNOWN (-1) is the one transient code: WebView reports it for loads
                // aborted by a superseding navigation (redirect, location.replace), and treating
                // those as failures would flash a false error mid-flow. Every OTHER main-frame
                // error means the WebView is now showing (or about to show) its stock error page,
                // so the native screen must cover it — previously only a short allow-list did,
                // and codes outside it (e.g. ERROR_IO from a mid-transfer drop) left the raw
                // browser error page on screen with no native retry UI at all.
                if (errorCode == android.webkit.WebViewClient.ERROR_UNKNOWN) return@AppWebViewClient
                mainFrameErrored = true
                cancelPageLoadWatchdog()
                cancelRenderCheck()
                binding.swipeRefresh.isRefreshing = false
                binding.loadingProgress.visibility = View.GONE
                lastFailedUrl = failingUrl
                if (!NetworkUtils.isOnline(this)) showOffline() else showPageError()
            },
            onRendererGone = {
                // Per Android's WebView docs: once this fires, the WebView instance is dead —
                // don't touch it beyond destroy()/view-hierarchy changes. recreate() tears
                // down this Activity (onDestroy -> binding.webView.destroy()) and builds a
                // fresh one with a fresh WebView, which is the supported recovery path for a
                // single-WebView Activity like this one.
                CrashLogger.e("Lifecycle", "Renderer process gone — recreating Activity to recover")
                if (!isFinishing && !isDestroyed) recreate()
            },
        )
        webView.webChromeClient = AppWebChromeClient(this, this)
        webView.addJavascriptInterface(WebAppBridge(this) { lastMainFrameUrl }, "ContextOSNative")

        // Kills the native edge-glow bounce effect on overscroll — paired with
        // setUpSwipeRefresh() disabling the pull-to-refresh gesture below.
        webView.overScrollMode = View.OVER_SCROLL_NEVER

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            DownloadHelper.enqueue(this, url, userAgent, contentDisposition, mimeType)
        }
    }

    // Pull-to-refresh is disabled outright: SwipeRefreshLayout re-enabling itself only at
    // scrollY == 0 raced against WebView fling/overscroll — flinging back up to the top
    // could land exactly on scrollY == 0 mid-gesture, and the same continued touch-move
    // then got reinterpreted as a pull-to-refresh drag, reloading the page unexpectedly.
    private fun setUpSwipeRefresh() {
        binding.swipeRefresh.isEnabled = false
    }

    private var lastBackPressAtMs = 0L

    private fun setUpBackNavigation() {
        onBackPressedDispatcher.addCallback(this) {
            when {
                // Normal in-page history (SPA pushState is tracked by WebView history too).
                // This same branch also covers the error screen: going back lands on the last
                // GOOD page, whose onPageFinished hides the overlay. (The old behavior —
                // plain-hiding the overlay on back — revealed the stock Chromium error page
                // sitting in the WebView underneath.) With no history, fall through to the
                // double-press exit below, so a failed first load never traps the user.
                binding.webView.canGoBack() -> binding.webView.goBack()
                // At the root with no history: require a second press within a short window so a
                // single accidental tap never drops the user out of the app. moveTaskToBack keeps
                // the process (and its WebView/session) alive in the background rather than killing it.
                else -> {
                    val now = System.currentTimeMillis()
                    if (now - lastBackPressAtMs < BACK_EXIT_WINDOW_MS) {
                        moveTaskToBack(true)
                    } else {
                        lastBackPressAtMs = now
                        Toast.makeText(this@MainActivity, R.string.press_back_again, Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    // Deliberately does NOT hide the error screen first: the native screen stays up (button
    // flips to "Retrying…") until the reload actually SUCCEEDS — onPageFinished hides it. Hiding
    // before/while the reload ran showed whatever the WebView last painted, i.e. the stock
    // Chromium error page, for the whole duration of every retry (including the automatic one
    // fired each time connectivity came back — the exact raw-browser screen users reported).
    // Retrying while still offline is also fine: the load fails fast, onLoadError re-shows the
    // idle offline state, and the button springs back to "Retry".
    private fun retryLoad() {
        binding.offlineRetryButton.isEnabled = false
        binding.offlineRetryButton.setText(R.string.offline_retrying)
        binding.webView.loadUrl(lastFailedUrl ?: Constants.BASE_URL)
    }

    // ---- Connectivity ------------------------------------------------------------------------

    override fun onStart() {
        super.onStart()
        CrashLogger.d("Lifecycle", "onStart")
        connectivityManager.registerDefaultNetworkCallback(networkCallback)
    }

    override fun onStop() {
        super.onStop()
        CrashLogger.d("Lifecycle", "onStop")
        runCatching { connectivityManager.unregisterNetworkCallback(networkCallback) }
        CookieManager.getInstance().flush()
    }

    // Android's WebView docs are explicit that onPause()/onResume() must be paired with the
    // Activity's own lifecycle ("failure to call these may cause strange results") — this pairing
    // was missing entirely, and its absence is a known cause of a WebView rendering solid black
    // after the Activity regains focus from another surface (a Custom Tab, the system Google
    // account chooser, etc.) — exactly the shape of "black screen right after sign-in".
    override fun onPause() {
        super.onPause()
        CrashLogger.d("Lifecycle", "onPause — pausing WebView")
        binding.webView.onPause()
    }

    override fun onResume() {
        super.onResume()
        CrashLogger.d("Lifecycle", "onResume — resuming WebView")
        binding.webView.onResume()
        // onPageFinished alone isn't enough to catch a Clerk session that only becomes real
        // *after* the page settles — e.g. /native-sign-in consuming its ticket is async and
        // happens after that page's own onPageFinished already fired, with no further full
        // page load afterward (client-side routing only) to give the mint script a second
        // chance. Retrying here — matching how the site's own BubbleExtensionPrompts already
        // re-checks "on every resume/focus" for the same reason — catches it whenever the user
        // next returns to the app instead of never.
        maybeSyncBubbleAuth(binding.webView.url)
    }

    // ---- Extension connect-flow key extraction ------------------------------------------------
    // When the popup's "Connect with ContextOS" button is tapped, the connect URL is opened
    // here (in the main WebView where OAuth works). Once the user signs in, the page sets
    // `#key=ctxos_…` in the URL hash. This method injects a script that watches for that hash
    // and calls ContextOSNative.onExtensionKeyExtracted(), which saves the credentials to
    // SharedPreferences. The popup picks them up on its next open (see chrome-shim.js).

    private fun maybeExtractExtensionKey(url: String?) {
        if (url == null || !url.contains("/connect-extension")) return
        binding.webView.evaluateJavascript(CONNECT_EXTRACT_SCRIPT, null)
    }

    // ---- Floating Brain bubble auth sync ------------------------------------------------------
    // Zero frontend changes, by design (see the Android bubble spec) — this reuses the exact
    // mechanism extension/background.js's STORE_CLERK_TOKEN handler already uses (POST
    // /api/v1/api-keys with the Clerk session's own bearer token) rather than adding a new
    // bridge call the website would need to invoke itself. Runs on every load of the app's own
    // pages: mints a bubble API key the first time a Clerk session is found and none is stored
    // yet, or detects a sign-out (Clerk loaded, no session, but a key IS stored) and clears it.
    private fun maybeSyncBubbleAuth(url: String?) {
        val host = url?.let { Uri.parse(it).host?.lowercase() }
        if (host != Constants.APP_HOST) return
        if (com.usecontextos.app.bubble.data.BubbleCredentialStore.isSignedIn(this)) {
            // Read the CURRENT signed-in email off the page, then reconcile the stored key
            // against it (see reconcileBubbleKey). Result comes back JSON-encoded, so a string
            // arrives wrapped in quotes; empty/"" means Clerk hasn't hydrated yet — treat as
            // unknown and don't act on incomplete data.
            binding.webView.evaluateJavascript(CLERK_EMAIL_SCRIPT) { raw ->
                val clerkEmail = raw?.trim()?.removeSurrounding("\"")?.takeIf { it.isNotBlank() && it != "null" }
                reconcileBubbleKey(clerkEmail)
            }
            binding.webView.evaluateJavascript(BUBBLE_SIGNOUT_CHECK_SCRIPT, null)
        } else {
            runBubbleMint()
        }
    }

    // Login persistence: keep PREF_WAS_SIGNED_IN in sync with the live Clerk session on every
    // app-host page load (so the next cold start knows where to open — see onCreate), AND, when
    // signed in but sitting on the landing page, redirect to the dashboard so a returning user
    // never has to pass back through the landing page. Both are driven by AUTH_STATE_SCRIPT ->
    // ContextOSNative.onAuthState() — no website change required.
    private fun maybeSyncAuthState(url: String?) {
        val host = url?.let { Uri.parse(it).host?.lowercase() }
        if (host != Constants.APP_HOST) return
        binding.webView.evaluateJavascript(AUTH_STATE_SCRIPT, null)
    }

    // Two ways a stored key can be wrong even though one is present:
    //  1. It's been revoked/deleted server-side (the connect-extension delete-all-recreate, a
    //     free-plan key collision) — the request 401/403s. This was the "Connection expired —
    //     sign in again" the user hit despite being signed in.
    //  2. It's VALID but belongs to a DIFFERENT account — the user signed out and back in with
    //     another email. The key still works, so a plain validity check passes, but it now points
    //     at the wrong account: the bubble/selection-save would silently save into the previous
    //     user's memories. Comparing the key's own account email against the currently signed-in
    //     email is the only way to catch this.
    // Either case clears the stored key and re-mints one for the account that's actually signed
    // in now. Only a real auth failure or a definite email mismatch acts — a network blip or an
    // unknown current email (Clerk still hydrating) is left alone so a good key is never wiped.
    private fun reconcileBubbleKey(currentEmail: String?) {
        lifecycleScope.launch {
            val result = runCatching {
                com.usecontextos.app.bubble.data.ContextOSApi(this@MainActivity).getUserInfo()
            }
            val err = result.exceptionOrNull()
            val mismatch = err == null &&
                currentEmail != null &&
                result.getOrNull()?.email?.let { !it.equals(currentEmail, ignoreCase = true) } == true
            when {
                err is com.usecontextos.app.bubble.data.BubbleApiError.Auth -> {
                    CrashLogger.d("BubbleAuth", "Stored key rejected (401/403) — clearing and re-minting")
                    com.usecontextos.app.bubble.data.BubbleCredentialStore.clear(this@MainActivity)
                    runBubbleMint()
                }
                mismatch -> {
                    CrashLogger.d("BubbleAuth", "Stored key belongs to a different account than the signed-in email — re-minting")
                    com.usecontextos.app.bubble.data.BubbleCredentialStore.clear(this@MainActivity)
                    runBubbleMint()
                }
            }
        }
    }

    // Debounced because the mint now DELETES all existing keys before creating one (so the
    // account never accumulates duplicates — see BUBBLE_AUTO_MINT_SCRIPT). maybeSyncBubbleAuth
    // fires from both onPageFinished and onResume, often back-to-back; without this guard those
    // two calls would run delete-all-then-create twice, the second run wiping the first's
    // freshly-minted key and creating yet another — visible churn on the account. One mint per
    // window is plenty; onBubbleKeyMinted stores the result, after which isSignedIn() is true
    // and this branch isn't reached again anyway.
    private var lastBubbleMintAtMs = 0L
    private fun runBubbleMint() {
        val now = System.currentTimeMillis()
        if (now - lastBubbleMintAtMs < BUBBLE_MINT_DEBOUNCE_MS) return
        lastBubbleMintAtMs = now
        binding.webView.evaluateJavascript(BUBBLE_AUTO_MINT_SCRIPT, null)
    }

    companion object {
        // How long a navigation gets before the watchdog treats it as failed. Generous on
        // purpose — this only needs to catch a genuine hang (server accepted the connection
        // but never responds), not flag a normal slow mobile-network load as broken.
        private const val PAGE_LOAD_TIMEOUT_MS = 20_000L

        // Window in which a second back-press at the app root actually exits (see
        // setUpBackNavigation) — long enough to be deliberate, short enough not to feel sticky.
        private const val BACK_EXIT_WINDOW_MS = 2_000L

        // Minimum gap between bubble key mints — see runBubbleMint().
        private const val BUBBLE_MINT_DEBOUNCE_MS = 15_000L

        // How long to give React to hydrate and paint before the render check runs.
        // Generous on purpose — this only needs to catch "never rendered", not flag a
        // slow-but-working mount on a low-end device or throttled connection.
        private const val RENDER_CHECK_DELAY_MS = 4_000L

        // True only if the SPA root actually has content. Guards against both an empty
        // mount (uncaught exception before the first render) and a root that exists but
        // was never populated.
        private const val RENDER_CHECK_SCRIPT = """
            (function() {
              var root = document.getElementById('root');
              return !!(root && root.children && root.children.length > 0);
            })();
        """

        // Injected into the main WebView when it loads /connect-extension.
        // Three jobs:
        // 1. Hash watcher — saves #key=ctxos_… to SharedPrefs via native bridge
        // 2. Fetch patch — serializes non-string `detail` so errors are readable
        // 3. Auto-retry — if the page shows an error (e.g. LIMIT_REACHED because
        //    a key already exists on the free plan), deletes existing keys and
        //    creates a fresh one using the Clerk session token
        private const val CONNECT_EXTRACT_SCRIPT = """
            (function() {
              /* ── 1. Hash watcher ──────────────────────────────────────────── */
              function tryExtractKey() {
                var hash = window.location.hash;
                var match = hash.match(/[#&]key=([^&]+)/);
                if (!match) return false;
                var apiKey = decodeURIComponent(match[1]);
                if (apiKey.indexOf("ctxos_") !== 0) return false;
                var apiUrlMatch = hash.match(/[#&]apiUrl=([^&]+)/);
                var apiUrl = apiUrlMatch ? decodeURIComponent(apiUrlMatch[1]) : "";
                var frontendUrlMatch = hash.match(/[#&]frontendUrl=([^&]+)/);
                var frontendUrl = frontendUrlMatch ? decodeURIComponent(frontendUrlMatch[1]) : "";
                if (window.ContextOSNative) {
                  window.ContextOSNative.onExtensionKeyExtracted(apiKey, apiUrl, frontendUrl);
                }
                return true;
              }
              if (tryExtractKey()) return;
              window.addEventListener("hashchange", tryExtractKey);

              /* ── 2. Patch fetch() to fix error serialization ──────────────── */
              var origFetch = window.fetch;
              window.fetch = function(url, opts) {
                return origFetch.apply(this, arguments).then(function(res) {
                  if (typeof url === "string" && url.indexOf("/api/v1/api-keys") !== -1 && !res.ok) {
                    return res.clone().json().catch(function() { return {}; }).then(function(body) {
                      var detail = body.detail;
                      if (detail && typeof detail !== "string") detail = JSON.stringify(detail);
                      var fixedBody = Object.assign({}, body, { detail: detail || ("Server error " + res.status) });
                      return new Response(JSON.stringify(fixedBody), {
                        status: res.status, statusText: res.statusText, headers: res.headers
                      });
                    });
                  }
                  return res;
                });
              };

              /* ── 3. Auto-retry: handle LIMIT_REACHED by recycling old keys ── */
              var retried = false;
              var observer = new MutationObserver(function() {
                if (retried) return;
                var texts = [];
                document.querySelectorAll("p").forEach(function(p) { texts.push(p.textContent || ""); });
                var joined = texts.join(" ");
                if (joined.indexOf("Connection failed") === -1 &&
                    joined.indexOf("[object Object]") === -1 &&
                    joined.indexOf("LIMIT_REACHED") === -1 &&
                    joined.indexOf("limit") === -1) return;
                retried = true;

                var apiBase = "https://api.usecontextos.com";
                function getClerkToken() {
                  if (window.Clerk && window.Clerk.session) {
                    return window.Clerk.session.getToken();
                  }
                  return Promise.reject(new Error("Clerk not available"));
                }
                function apiCall(method, path, body, token) {
                  var headers = { "Content-Type": "application/json", "Authorization": "Bearer " + token };
                  var opts = { method: method, headers: headers };
                  if (body) opts.body = JSON.stringify(body);
                  return origFetch(apiBase + path, opts);
                }

                getClerkToken().then(function(token) {
                  // Step 1: List existing keys
                  return apiCall("GET", "/api/v1/api-keys", null, token).then(function(res) {
                    if (!res.ok) return [];
                    return res.json();
                  }).then(function(keys) {
                    // Step 2: Delete ALL existing keys to free up the limit
                    var deletes = (Array.isArray(keys) ? keys : []).map(function(k) {
                      return apiCall("DELETE", "/api/v1/api-keys/" + k.id, null, token);
                    });
                    return Promise.all(deletes);
                  }).then(function() {
                    // Step 3: Create a fresh key
                    return apiCall("POST", "/api/v1/api-keys", { name: "Android App" }, token);
                  }).then(function(res) {
                    if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
                    return res.json();
                  }).then(function(created) {
                    if (created && created.key) {
                      // Set hash — triggers the hash watcher above
                      window.location.hash =
                        "key=" + encodeURIComponent(created.key) +
                        "&apiUrl=" + encodeURIComponent(apiBase) +
                        "&frontendUrl=" + encodeURIComponent(window.location.origin);
                    }
                  });
                }).catch(function(e) {
                  console.error("[ContextOS] Auto-retry failed:", e);
                });
              });
              observer.observe(document.body || document.documentElement, {
                childList: true, subtree: true, characterData: true
              });
            })();
        """

        // Mints the mobile "ContextOS Mobile" key and keeps the account to exactly ONE of them,
        // WITHOUT touching the Chrome extension's key — the free plan now allows two keys (one
        // mobile, one extension; see backend PLAN_LIMITS), so the two must coexist rather than
        // clobber each other. It deletes only keys with a KNOWN MOBILE name (this key and its
        // historical names, so reinstalls/re-mints don't accumulate mobile duplicates), leaves
        // "Chrome Extension" and any other key alone, then creates a fresh mobile key.
        //
        // Only injected when NO usable key is stored locally (see maybeSyncBubbleAuth): if a key
        // is already shared in from the extension flow, isSignedIn() is true and this never runs.
        private const val BUBBLE_AUTO_MINT_SCRIPT = """
            (function() {
              if (!window.Clerk || !window.Clerk.session) return;
              window.Clerk.session.getToken().then(function(token) {
                if (!token) return;
                var apiBase = document.documentElement.dataset.ctxosApiUrl || "https://api.usecontextos.com";
                var MOBILE_NAMES = ["ContextOS Mobile", "Android Bubble", "Android App"];
                function api(method, path, body) {
                  var opts = { method: method, headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token } };
                  if (body) opts.body = JSON.stringify(body);
                  return fetch(apiBase + path, opts);
                }
                api("GET", "/api/v1/api-keys").then(function(res) {
                  return res.ok ? res.json() : [];
                }).then(function(keys) {
                  // Only our own mobile keys — never "Chrome Extension" or anything else.
                  var deletes = (Array.isArray(keys) ? keys : [])
                    .filter(function(k) { return MOBILE_NAMES.indexOf(k.name) !== -1; })
                    .map(function(k) { return api("DELETE", "/api/v1/api-keys/" + k.id).catch(function() {}); });
                  return Promise.all(deletes);
                }).then(function() {
                  return api("POST", "/api/v1/api-keys", { name: "ContextOS Mobile" });
                }).then(function(res) {
                  return res.ok ? res.json() : null;
                }).then(function(created) {
                  if (created && created.key && window.ContextOSNative) {
                    window.ContextOSNative.onBubbleKeyMinted(created.key, apiBase);
                  }
                }).catch(function() {});
              }).catch(function() {});
            })();
        """

        // Only injected when a key IS already stored (see maybeSyncBubbleAuth) — Clerk.loaded
        // gates this so it can't fire "signed out" while Clerk is still hydrating on a fresh
        // page load, which would otherwise wipe a perfectly valid key on every cold start.
        private const val BUBBLE_SIGNOUT_CHECK_SCRIPT = """
            (function() {
              if (window.Clerk && window.Clerk.loaded && !window.Clerk.session && window.ContextOSNative) {
                window.ContextOSNative.onBubbleSignedOut();
              }
            })();
        """

        // Reads the currently signed-in account's primary email off the live Clerk session, so
        // native code can tell whether the stored bubble key still belongs to this account (see
        // reconcileBubbleKey). Returns "" when Clerk hasn't hydrated yet — caller treats that as
        // "unknown, don't act", never as a mismatch.
        private const val CLERK_EMAIL_SCRIPT = """
            (function() {
              try {
                if (window.Clerk && window.Clerk.user && window.Clerk.user.primaryEmailAddress) {
                  return window.Clerk.user.primaryEmailAddress.emailAddress || "";
                }
              } catch (e) {}
              return "";
            })();
        """

        // Login persistence (see maybeSyncAuthState): once Clerk has hydrated, report the live
        // signed-in state to native (which persists it as PREF_WAS_SIGNED_IN for the next cold
        // start), and if signed in while sitting on the landing page, replace() to the dashboard
        // so returning users skip the landing page. Polls briefly because Clerk loads async; only
        // reports once loaded, so a not-yet-hydrated page never flips the flag off by mistake.
        private const val AUTH_STATE_SCRIPT = """
            (function() {
              function report() {
                var signedIn = !!(window.Clerk && window.Clerk.session);
                try {
                  if (window.ContextOSNative && window.ContextOSNative.onAuthState) {
                    window.ContextOSNative.onAuthState(signedIn);
                  }
                } catch (e) {}
                var path = window.location.pathname;
                if (signedIn && (path === "/" || path === "")) {
                  window.location.replace("/dashboard");
                }
              }
              if (window.Clerk && window.Clerk.loaded) { report(); return; }
              var tries = 0;
              var iv = setInterval(function() {
                tries++;
                if ((window.Clerk && window.Clerk.loaded) || tries > 50) {
                  clearInterval(iv);
                  report();
                }
              }, 100);
            })();
        """
    }

    private fun onConnectivityChanged(online: Boolean) {
        if (online && binding.offlineContainer.visibility == View.VISIBLE) {
            retryLoad()
        } else if (!online && (mainFrameErrored || watchdogRunnable != null)) {
            // Only take over the screen when there's nothing usable to look at (a failed or
            // still-in-flight load). If the user is reading an already-rendered page, a brief
            // network drop shouldn't slam a full-screen overlay over working content — the SPA
            // surfaces its own API errors, and the next navigation that fails lands here anyway.
            showOffline()
        }
    }

    private fun showOffline() {
        binding.offlineTitle.setText(R.string.offline_title)
        binding.offlineMessage.setText(R.string.offline_message)
        showErrorScreen()
    }

    // Same retry UI as showOffline(), different copy — this path fires when the page
    // itself reported success (no network/SSL error) but never actually rendered, so
    // telling the user to "check your connection" would be wrong.
    private fun showPageError() {
        binding.offlineTitle.setText(R.string.page_error_title)
        binding.offlineMessage.setText(R.string.page_error_message)
        showErrorScreen()
    }

    private fun showErrorScreen() {
        binding.offlineRetryButton.isEnabled = true
        binding.offlineRetryButton.setText(R.string.offline_retry)
        binding.offlineContainer.visibility = View.VISIBLE
    }

    private fun hideOffline() {
        binding.offlineRetryButton.isEnabled = true
        binding.offlineRetryButton.setText(R.string.offline_retry)
        binding.offlineContainer.visibility = View.GONE
    }

    // ---- WebViewHost (bridges AppWebChromeClient back into this Activity) --------------------

    override fun onLoadProgress(progress: Int) {
        binding.loadingProgress.progress = progress
        binding.loadingProgress.visibility = if (progress in 1..99) View.VISIBLE else View.GONE
    }

    override fun launchFileChooser(intent: Intent, callback: ValueCallback<Array<Uri>>) {
        pendingFileCallback = { uris -> callback.onReceiveValue(uris) }
        fileChooserLauncher.launch(intent)
    }

    override fun requestRuntimePermissions(permissions: Array<String>, onResult: (Boolean) -> Unit) {
        val alreadyGranted = permissions.all {
            checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED
        }
        if (alreadyGranted) {
            onResult(true)
            return
        }
        pendingPermissionResult = onResult
        permissionLauncher.launch(permissions)
    }

    override fun enterFullscreen(view: View, callback: WebChromeClient.CustomViewCallback) {
        if (binding.fullscreenContainer.childCount > 0) {
            callback.onCustomViewHidden()
            return
        }
        binding.swipeRefresh.visibility = View.GONE
        binding.fullscreenContainer.visibility = View.VISIBLE
        binding.fullscreenContainer.addView(
            view,
            ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
        )
        setImmersiveMode(true)
    }

    override fun exitFullscreen() {
        binding.fullscreenContainer.removeAllViews()
        binding.fullscreenContainer.visibility = View.GONE
        binding.swipeRefresh.visibility = View.VISIBLE
        setImmersiveMode(false)
    }

    private fun setImmersiveMode(enabled: Boolean) {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        if (enabled) {
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars())
        }
    }

    // ---- Deep links + share intent ------------------------------------------------------------

    /** Returns true if it navigated the WebView somewhere (so callers don't also load the homepage). */
    private fun handleIntent(intent: Intent): Boolean {
        return when (intent.action) {
            Intent.ACTION_VIEW -> intent.data?.let { uri -> loadDeepLink(uri); true } ?: false
            Intent.ACTION_SEND, Intent.ACTION_SEND_MULTIPLE -> { handleSharedContent(intent); true }
            else -> false
        }
    }

    private fun loadDeepLink(uri: Uri) {
        val host = uri.host?.lowercase().orEmpty()
        val target = if (Constants.IN_APP_HOST_SUFFIXES.any { host == it || host.endsWith(".$it") }) {
            uri.toString()
        } else if (uri.scheme == "contextos") {
            // contextos://open/<path> -> https://www.usecontextos.com/<path>
            Constants.BASE_URL.trimEnd('/') + "/" + uri.schemeSpecificPart.trimStart('/')
        } else {
            Constants.BASE_URL
        }
        binding.webView.loadUrl(target)
    }

    // The one hand-off point for every capture source — see the `capture` package.
    // Today only ShareIntentCaptureSource feeds it; a future capture source (see
    // capture/accessibility/CaptureAccessibilityServiceStub.kt) would call this same
    // repository without MainActivity needing to change.
    private val captureRepository = CaptureRepository { item ->
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Shared to ContextOS", item.text))
        Toast.makeText(this, "Copied — paste it on the New Memory screen", Toast.LENGTH_LONG).show()
        binding.webView.loadUrl(Constants.BASE_URL.trimEnd('/') + "/memories/new")
    }

    private fun handleSharedContent(intent: Intent) {
        val referrerPackage = referrer?.host
        val item = ShareIntentCaptureSource.fromIntent(intent, referrerPackage)
        val sharedFileUri: Uri? = intent.getParcelableExtra(Intent.EXTRA_STREAM)
        when {
            // Plain shared TEXT still goes through the existing clipboard-capture path.
            item != null -> captureRepository.handle(item)
            // A shared FILE (PDF/DOCX/PPTX/TXT/image) now extracts its raw text natively and
            // saves via the existing saveMemory — no WebView upload page needed. See
            // capture/file/FileCaptureHandler + FileTextExtractor.
            sharedFileUri != null -> com.usecontextos.app.capture.file.FileCaptureHandler.handle(this, sharedFileUri)
            else -> binding.webView.loadUrl(Constants.BASE_URL.trimEnd('/') + "/memories/new")
        }
    }

    override fun onDestroy() {
        cancelPageLoadWatchdog()
        cancelRenderCheck()
        binding.webView.destroy()
        super.onDestroy()
    }
}
