package com.usecontextos.app.webview

import android.content.Intent
import android.net.Uri
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient

/** Narrow seam between AppWebChromeClient and MainActivity for the bits that need an Activity. */
interface WebViewHost {
    fun onLoadProgress(progress: Int)
    fun launchFileChooser(intent: Intent, callback: ValueCallback<Array<Uri>>)
    fun requestRuntimePermissions(permissions: Array<String>, onResult: (allGranted: Boolean) -> Unit)
    fun enterFullscreen(view: View, callback: WebChromeClient.CustomViewCallback)
    fun exitFullscreen()
}
