package com.usecontextos.app.webview

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.browser.customtabs.CustomTabsIntent
import com.usecontextos.app.util.Constants
import com.usecontextos.app.util.CrashLogger

/**
 * Routing rule: URLs on the site's own origin (or its auth infra) load in-app.
 * Everything else — Google/GitHub OAuth, Stripe Checkout, wa.me, external docs —
 * opens in Chrome Custom Tabs. This is required, not cosmetic: Google's OAuth
 * consent screen explicitly refuses to render inside an embedded WebView
 * ("disallowed_useragent"), and Custom Tabs is the sanctioned workaround.
 */
class AppWebViewClient(
    private val context: Context,
    private val onPageStarted: (String?) -> Unit,
    private val onPageFinished: (String?) -> Unit,
    private val onLoadError: (Int, String?, String?) -> Unit,
    private val onRendererGone: () -> Unit,
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val uri = request.url
        val scheme = uri.scheme?.lowercase()

        if (scheme != "http" && scheme != "https") {
            return launchExternalIntent(uri)
        }

        val host = uri.host?.lowercase().orEmpty()
        return if (isInAppHost(host)) {
            false // let the WebView load it normally
        } else {
            CrashLogger.d("Navigation", "Routing OUT of WebView to Custom Tab: $uri")
            openInCustomTab(uri)
            true
        }
    }

    private fun isInAppHost(host: String): Boolean =
        Constants.IN_APP_HOST_SUFFIXES.any { host == it || host.endsWith(".$it") }

    private fun isOAuthProviderHost(host: String): Boolean =
        Constants.OAUTH_PROVIDER_HOSTS.any { host == it || host.endsWith(".$it") }

    private fun openInCustomTab(uri: Uri) {
        // Restart the WHOLE sign-in flow in the Custom Tab, not just this one OAuth hop.
        // WebView and Custom Tabs never share cookies (different apps, different storage —
        // an OS sandboxing rule, not something app code can bridge). Handing off only the
        // Google/GitHub/Apple step leaves the rest of Clerk's handshake (its callback, the
        // final redirect) stranded in that separate, cookie-less-for-this-flow context, which
        // is what produced the "Unauthorized request" error. Restarting at /sign-in instead
        // keeps the entire handshake in one continuous browsing session, same as a normal
        // browser tab. /native-callback hands the completed session back to the app — see
        // NativeCallbackPage.tsx and MainActivity.loadDeepLink().
        val target = if (isOAuthProviderHost(uri.host?.lowercase().orEmpty())) {
            CrashLogger.d("Navigation", "OAuth provider host ($uri) — restarting full sign-in flow in Custom Tab")
            Uri.parse(
                Constants.BASE_URL.trimEnd('/') + "/sign-in?redirect_url=" + Uri.encode("/native-callback")
            )
        } else {
            uri
        }
        val intent = CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
        intent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            intent.launchUrl(context, target)
        } catch (e: ActivityNotFoundException) {
            launchExternalIntent(target)
        }
    }

    private fun launchExternalIntent(uri: Uri): Boolean {
        return try {
            context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (e: ActivityNotFoundException) {
            // No app can handle it (e.g. an intent:// link with no fallback) — swallow rather than crash.
            true
        }
    }

    override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
        super.onPageStarted(view, url, favicon)
        onPageStarted(url)
    }

    override fun onPageFinished(view: WebView, url: String?) {
        super.onPageFinished(view, url)
        onPageFinished(url)
    }

    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        super.onReceivedError(view, request, error)
        if (request.isForMainFrame) {
            CrashLogger.e("Navigation", "onReceivedError (main frame): code=${error.errorCode} desc=${error.description} url=${request.url}")
            onLoadError(error.errorCode, error.description?.toString(), request.url?.toString())
        }
    }

    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
        // Never proceed past a certificate error — this is HTTPS-only app; a bad cert
        // means a possible MITM, not a page we should silently render.
        CrashLogger.e("Navigation", "onReceivedSslError: primaryError=${error.primaryError} url=${error.url}")
        handler.cancel()
        // Use the real SSL-handshake code (not ERROR_UNKNOWN) so the host treats this as a
        // definite, retryable failure rather than a transient/aborted load.
        onLoadError(ERROR_FAILED_SSL_HANDSHAKE, "SSL error: ${error.primaryError}", error.url)
    }

    // THE fix for the black-screen-after-login bug: on API 26+, if the WebView's sandboxed
    // renderer process crashes or is reclaimed under memory pressure and this callback isn't
    // overridden, Android kills the ENTIRE app process, not just the WebView — confirmed live
    // via logcat ("Render process kill ... wasn't handed by all associated webviews, killing
    // application" -> "Process ... exited due to signal 9"). The app then cold-restarts
    // mid-navigation, which is exactly what a user sees as a black screen that never recovers.
    // Returning true here tells the OS "handled — don't kill us," and onRendererGone() drives
    // recovery instead of a full process death.
    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        CrashLogger.e(
            "Navigation",
            "onRenderProcessGone: didCrash=${detail.didCrash()} rendererPriorityAtExit=${detail.rendererPriorityAtExit()}",
        )
        onRendererGone()
        return true
    }
}
