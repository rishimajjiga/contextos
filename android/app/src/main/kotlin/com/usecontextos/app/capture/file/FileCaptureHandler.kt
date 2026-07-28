package com.usecontextos.app.capture.file

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import com.usecontextos.app.MainActivity
import com.usecontextos.app.bubble.data.BubbleApiError
import com.usecontextos.app.bubble.data.BubbleCredentialStore
import com.usecontextos.app.bubble.data.ContextOSApi
import com.usecontextos.app.util.CrashLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * The single connection point between file text-extraction and the EXISTING save function
 * (ContextOSApi.saveMemory — the same one the bubble and select-text use). No new save system:
 * extract raw text -> saveMemory(title = filename, content = raw text) -> toast. Shared by the
 * file picker (FilePickerActivity) and the share-a-file path (MainActivity.handleSharedContent).
 *
 * The content saved is the extractor's output verbatim — not summarized, titled, or rewritten.
 * The only metadata is the file's own name as the title, because the memory API requires one.
 */
object FileCaptureHandler {

    // Application-scoped so the save survives the launching Activity finishing immediately.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun handle(context: Context, uri: Uri) {
        val appContext = context.applicationContext

        if (!BubbleCredentialStore.isSignedIn(appContext)) {
            toast(appContext, "Sign in to ContextOS first")
            appContext.startActivity(
                Intent(appContext, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
            )
            return
        }

        val title = FileTextExtractor.displayName(appContext, uri) ?: "Uploaded file"
        toast(appContext, "Extracting text…")

        scope.launch {
            val result = runCatching {
                val text = FileTextExtractor.extract(appContext, uri) // raw text; may throw EmptyExtraction
                ContextOSApi(appContext).saveMemory(title = title, content = text)
            }
            Handler(Looper.getMainLooper()).post {
                result.fold(
                    onSuccess = { toast(appContext, "✓ Saved to ContextOS") },
                    onFailure = { e -> onError(appContext, e) },
                )
            }
        }
    }

    private fun onError(appContext: Context, e: Throwable) {
        CrashLogger.e("FileCapture", "file save failed", e)
        when (e) {
            is FileTextExtractor.EmptyExtraction ->
                toast(appContext, "No readable text found in that file.")
            is BubbleApiError.LimitReached -> {
                toast(appContext, "Memory limit reached — upgrade your plan to save more.")
                appContext.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("contextos://plans"), appContext, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
                )
            }
            is BubbleApiError.Auth -> {
                // Stale key — clear it so the app re-mints on next open (see maybeSyncBubbleAuth).
                BubbleCredentialStore.clear(appContext)
                toast(appContext, "ContextOS needs to reconnect — open the app once, then try again.")
            }
            else -> toast(appContext, "Couldn't save. Check your connection.")
        }
    }

    private fun toast(context: Context, msg: String) {
        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
    }
}
