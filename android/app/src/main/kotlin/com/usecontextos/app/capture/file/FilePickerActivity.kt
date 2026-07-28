package com.usecontextos.app.capture.file

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.usecontextos.app.bubble.FloatingBubbleService
import com.usecontextos.app.util.CrashLogger
import kotlinx.coroutines.launch

/**
 * The in-app "upload a file" entry point: opens the system document picker (ACTION_OPEN_DOCUMENT),
 * then does one of two things depending on how it was launched:
 *
 *  - PREVIEW mode (EXTRA_PREVIEW=true, set by the bubble's "📎" button): extract the raw text and
 *    hand it back to FloatingBubbleService, which prefills the Save tab so the user can review/edit
 *    before saving. Nothing is saved automatically.
 *  - AUTO-SAVE mode (default — launcher shortcut / share-to-ContextOS): extract and save straight
 *    away via FileCaptureHandler, since those paths have no bubble panel to preview in.
 *
 * Has no visible screen of its own (translucent), finishing as soon as it's done.
 */
class FilePickerActivity : ComponentActivity() {

    private val preview: Boolean by lazy { intent.getBooleanExtra(EXTRA_PREVIEW, false) }

    private val picker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) {
            finish()
            return@registerForActivityResult
        }
        runCatching {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        if (preview) extractForPreview(uri) else {
            FileCaptureHandler.handle(applicationContext, uri)
            finish()
        }
    }

    private fun extractForPreview(uri: Uri) {
        val appContext = applicationContext
        Toast.makeText(appContext, "Extracting text…", Toast.LENGTH_SHORT).show()
        lifecycleScope.launch {
            val result = runCatching {
                val title = FileTextExtractor.displayName(appContext, uri) ?: "Uploaded file"
                val text = FileTextExtractor.extract(appContext, uri) // raw text; may throw EmptyExtraction
                title to text
            }
            result.fold(
                onSuccess = { (title, text) ->
                    PendingFileText.set(title, text)
                    // Tell the running bubble service to open its Save tab prefilled for review.
                    ContextCompat.startForegroundService(
                        appContext,
                        Intent(appContext, FloatingBubbleService::class.java)
                            .setAction(FloatingBubbleService.ACTION_SHOW_FILE_PREVIEW),
                    )
                },
                onFailure = { e ->
                    CrashLogger.e("FilePicker", "preview extraction failed", e)
                    val msg = if (e is FileTextExtractor.EmptyExtraction) "No readable text found in that file."
                    else "Couldn't read that file."
                    Toast.makeText(appContext, msg, Toast.LENGTH_LONG).show()
                },
            )
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Guard against a relaunch re-firing the picker after a config change.
        if (savedInstanceState == null) {
            picker.launch(SUPPORTED_MIME_TYPES)
        }
    }

    companion object {
        const val EXTRA_PREVIEW = "extra_preview"

        // PDF, DOCX, PPTX, plain text (txt/md/csv), and images. "*/*" isn't used so the picker
        // only surfaces file types the extractor actually handles.
        val SUPPORTED_MIME_TYPES = arrayOf(
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
            "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
            "text/*",
            "image/*",
        )
    }
}
