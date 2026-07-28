package com.usecontextos.app.webview

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import com.usecontextos.app.util.Constants
import com.usecontextos.app.util.CrashLogger

class AppWebChromeClient(
    private val context: Context,
    private val host: WebViewHost,
) : WebChromeClient() {

    override fun onProgressChanged(view: WebView, newProgress: Int) {
        super.onProgressChanged(view, newProgress)
        host.onLoadProgress(newProgress)
    }

    // The website's OWN JS console output (including uncaught errors from its React app) —
    // WebView and Chrome are different rendering engines, so a page can genuinely throw here
    // even when it works fine in Chrome. This is the one place that can reveal a website-side
    // failure that's specific to running inside this app, without touching the website itself.
    override fun onConsoleMessage(message: ConsoleMessage): Boolean {
        val level = when (message.messageLevel()) {
            ConsoleMessage.MessageLevel.ERROR -> "E"
            ConsoleMessage.MessageLevel.WARNING -> "W"
            else -> "D"
        }
        val line = "${message.message()} (${message.sourceId()}:${message.lineNumber()})"
        if (level == "E") CrashLogger.e("WebConsole", line) else CrashLogger.d("WebConsole", line)
        return super.onConsoleMessage(message)
    }

    // ---- <input type=file> (document picker only) -------------------------------------------
    // Camera-capture was removed with the CAMERA permission (Play readiness): a file input opens
    // the system document picker, which surfaces the camera app on its own if the user wants it —
    // no host CAMERA permission required.

    override fun onShowFileChooser(
        webView: WebView,
        filePathCallback: ValueCallback<Array<Uri>>,
        fileChooserParams: FileChooserParams,
    ): Boolean {
        val contentIntent = fileChooserParams.createIntent().apply {
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        host.launchFileChooser(Intent.createChooser(contentIntent, null)) { resultUris ->
            filePathCallback.onReceiveValue(resultUris)
        }
        return true
    }

    // ---- WebRTC / geolocation: denied ---------------------------------------------------------
    // The app no longer declares CAMERA/RECORD_AUDIO/LOCATION (the web app uses none of them), so
    // any page request for them is denied cleanly rather than prompting for a permission the app
    // can't hold.

    override fun onPermissionRequest(request: PermissionRequest) {
        request.deny()
    }

    override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
        callback.invoke(origin, false, false)
    }

    // ---- Fullscreen video ----------------------------------------------------------------------

    override fun onShowCustomView(view: View, callback: CustomViewCallback) {
        host.enterFullscreen(view, callback)
    }

    override fun onHideCustomView() {
        host.exitFullscreen()
    }

    // ---- window.open() / target=_blank popups ---------------------------------------------------

    // OAuth providers whose consent screens are opened by Clerk in a popup window.
    // These must load inside the popup WebView (not Custom Tab) so the redirect chain
    // (provider → Clerk callback → app origin) completes in a context that can hand
    // the session back to the parent WebView.
    private val oauthHosts = setOf(
        "accounts.google.com",
        "github.com",
        "appleid.apple.com",
    )

    override fun onCreateWindow(
        view: WebView,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: android.os.Message,
    ): Boolean {
        CrashLogger.d("OAuthPopup", "onCreateWindow — opening popup WebView (isDialog=$isDialog userGesture=$isUserGesture)")
        // Create a popup WebView that stays alive for the full OAuth redirect chain.
        // Clerk opens a window.open() for Google/GitHub sign-in; the popup navigates through
        // the OAuth provider, then to a Clerk callback URL that runs Clerk's own JS to finish
        // the handshake, and finally back to the app's own origin. Only at that last step do
        // we load the final URL in the parent and tear down the popup — grabbing the Clerk
        // callback URL any earlier sends it as a bare navigation instead of letting Clerk's
        // page complete normally, which Clerk's backend then rejects as unauthorized.
        // Non-OAuth external links still open in Custom Tabs.
        val transport = WebView(view.context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.setSupportMultipleWindows(false)
        }

        // CookieManager's third-party-cookie flag is per-WebView-instance, not global —
        // it was only ever being set on the main WebView. This popup carries the actual
        // OAuth redirect chain (provider -> Clerk callback), so any cross-origin cookies
        // Clerk sets along the way were being silently dropped here, which is exactly the
        // shape of "login works, session isn't maintained": the sign-in completes but the
        // session cookie never lands.
        android.webkit.CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(transport, true)
        }

        transport.webViewClient = object : android.webkit.WebViewClient() {
            override fun shouldOverrideUrlLoading(
                popupView: WebView,
                request: android.webkit.WebResourceRequest,
            ): Boolean {
                val url = request.url
                val popupHost = url.host?.lowercase().orEmpty()

                // Back on the app's own origin → the OAuth + Clerk handshake is done, hand off
                // to the parent WebView and close the popup.
                if (Constants.APP_ORIGIN_SUFFIXES.any { popupHost == it || popupHost.endsWith(".$it") }) {
                    CrashLogger.d("OAuthPopup", "Redirect chain reached app origin ($popupHost) — handing back to parent WebView: $url")
                    view.loadUrl(url.toString())
                    destroyPopupSafely(popupView)
                    return true
                }

                // OAuth provider OR Clerk's own domain → let the popup WebView handle it.
                // Clerk's callback page runs its own JS here to validate state and set the
                // session cookie before redirecting on to the app's origin above — it must
                // load as a normal page, not get intercepted mid-handshake.
                if (oauthHosts.any { popupHost == it || popupHost.endsWith(".$it") } ||
                    Constants.IN_APP_HOST_SUFFIXES.any { popupHost == it || popupHost.endsWith(".$it") }
                ) {
                    return false // load inside popup WebView
                }

                // Anything else → open in Chrome Custom Tab
                CrashLogger.d("OAuthPopup", "Unexpected host in redirect chain ($popupHost) — opening Custom Tab")
                val customTab = androidx.browser.customtabs.CustomTabsIntent.Builder().build()
                customTab.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                customTab.launchUrl(context, url)
                destroyPopupSafely(popupView)
                return true
            }
        }

        (resultMsg.obj as WebView.WebViewTransport).webView = transport
        resultMsg.sendToTarget()
        return true
    }

    // Tearing down a WebView from inside its OWN shouldOverrideUrlLoading callback (i.e. while
    // it's still on the call stack processing that very navigation) is a known WebView crash
    // vector. Posting the teardown defers it to the next message-loop iteration, after this
    // callback has returned control to the WebView, which is the documented-safe way to do it.
    private fun destroyPopupSafely(popupView: WebView) {
        popupView.stopLoading()
        popupView.post {
            CrashLogger.d("OAuthPopup", "Destroying popup WebView")
            runCatching { popupView.destroy() }
                .onFailure { CrashLogger.e("OAuthPopup", "popupView.destroy() threw", it) }
        }
    }

    override fun onJsAlert(
        view: WebView,
        url: String?,
        message: String?,
        result: android.webkit.JsResult,
    ): Boolean = showDialog(message, result, isConfirm = false)

    override fun onJsConfirm(
        view: WebView,
        url: String?,
        message: String?,
        result: android.webkit.JsResult,
    ): Boolean = showDialog(message, result, isConfirm = true)

    private fun showDialog(message: String?, result: android.webkit.JsResult, isConfirm: Boolean): Boolean {
        val builder = androidx.appcompat.app.AlertDialog.Builder(context)
            .setMessage(message)
            .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
            .setOnCancelListener { result.cancel() }
        if (isConfirm) {
            builder.setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
        }
        builder.create().show()
        return true
    }
}
