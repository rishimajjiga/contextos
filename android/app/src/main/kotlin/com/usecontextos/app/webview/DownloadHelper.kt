package com.usecontextos.app.webview

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.widget.Toast
import com.usecontextos.app.R
import java.net.URLConnection

/**
 * Bridges WebView's setDownloadListener to the system DownloadManager, carrying over
 * cookies/user-agent so authenticated downloads (e.g. exported documents) work.
 */
object DownloadHelper {
    fun enqueue(context: Context, url: String, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        // DownloadManager only accepts http/https and THROWS IllegalArgumentException for
        // anything else — and a React SPA's client-side exports arrive here as blob: URLs.
        // A tap on such a download must not crash the app; those blobs only exist inside the
        // page's own JS context, so the site's in-page handling is the right path for them.
        val scheme = Uri.parse(url).scheme?.lowercase()
        if (scheme != "http" && scheme != "https") {
            Toast.makeText(context, R.string.download_unsupported, Toast.LENGTH_SHORT).show()
            return
        }
        val request = DownloadManager.Request(Uri.parse(url)).apply {
            val cookies = CookieManager.getInstance().getCookie(url)
            if (cookies != null) addRequestHeader("Cookie", cookies)
            if (userAgent != null) addRequestHeader("User-Agent", userAgent)

            val guessedMime = mimeType?.takeIf { it.isNotBlank() && it != "application/octet-stream" }
                ?: URLConnection.guessContentTypeFromName(url)
                ?: MimeTypeMap.getSingleton().getMimeTypeFromExtension(MimeTypeMap.getFileExtensionFromUrl(url))

            val fileName = android.webkit.URLUtil.guessFileName(url, contentDisposition, guessedMime)

            setMimeType(guessedMime)
            setTitle(fileName)
            setDescription(context.getString(R.string.app_name))
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
        }

        // enqueue() itself can also throw (e.g. DownloadManager disabled by the OEM/user) —
        // degrade to a toast rather than crash a WebView tap.
        runCatching {
            val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            manager.enqueue(request)
            Toast.makeText(context, R.string.download_started, Toast.LENGTH_SHORT).show()
        }.onFailure {
            Toast.makeText(context, R.string.download_unsupported, Toast.LENGTH_SHORT).show()
        }
    }
}
