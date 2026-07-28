package com.usecontextos.app.bubble

import android.app.Activity
import android.content.Intent
import android.os.Bundle
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
 * "Save to ContextOS" in the system text-selection menu, in any app — the standard
 * ACTION_PROCESS_TEXT mechanism (same one Google Translate uses), chosen over an
 * AccessibilityService for selection on purpose: no special permission, no Play Store
 * accessibility-declaration risk, works wherever text is selectable.
 *
 * Also reachable as "Save to Team" via the ProcessTextTeam activity-alias — disabled by
 * default in the manifest and only enabled at runtime once the user's team plan is confirmed
 * (see FloatingBubbleService.loadAccountInfo), since the selection menu can't be filtered by
 * plan any other way. Saves happen directly with a toast, mirroring the Chrome extension's
 * right-click "Save selection" flow (no dialog in between).
 */
class ProcessTextActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()?.trim()
        if (text.isNullOrBlank()) {
            finish()
            return
        }

        if (!BubbleCredentialStore.isSignedIn(this)) {
            Toast.makeText(this, "Sign in to ContextOS first", Toast.LENGTH_LONG).show()
            startActivity(
                Intent(this, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
            )
            finish()
            return
        }

        // Which selection-menu entry launched us — the alias means "Save to Team".
        val toTeam = intent.component?.className?.endsWith("ProcessTextTeam") == true

        // First line (or first 60 chars) as the title, same heuristic the extension's
        // selection save uses; full selection as content.
        val title = text.lineSequence().first().take(60).ifBlank { "Saved selection" }

        Toast.makeText(this, if (toTeam) "Saving to team…" else "Saving to ContextOS…", Toast.LENGTH_SHORT).show()

        val appContext = applicationContext
        // Outlives this Activity on purpose: the activity finishes immediately (the selection
        // menu flow shouldn't hold a visible screen), but the save must still complete.
        saveScope.launch {
            val result = runCatching {
                ContextOSApi(appContext).saveMemory(
                    title = title,
                    content = text,
                    visibility = if (toTeam) "team" else "private",
                )
            }
            Handler(Looper.getMainLooper()).post {
                result.fold(
                    onSuccess = {
                        Toast.makeText(appContext, if (toTeam) "✓ Saved to team" else "✓ Saved to ContextOS", Toast.LENGTH_SHORT).show()
                    },
                    onFailure = { e ->
                        CrashLogger.e("ProcessText", "selection save failed", e)
                        when (e) {
                            is BubbleApiError.LimitReached -> {
                                // Mirror the in-panel behaviour: clear "limit reached" message,
                                // then take the user straight to the plans page to upgrade.
                                Toast.makeText(appContext, "Memory limit reached — upgrade your plan to save more.", Toast.LENGTH_LONG).show()
                                appContext.startActivity(
                                    Intent(Intent.ACTION_VIEW, android.net.Uri.parse("contextos://plans"), appContext, MainActivity::class.java)
                                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
                                )
                            }
                            is BubbleApiError.Auth -> {
                                // The stored bubble key was rejected — clear it so the app re-mints
                                // a fresh one from the still-valid Clerk session next time it opens
                                // (see MainActivity.maybeSyncBubbleAuth). The user is NOT actually
                                // signed out, so don't tell them to sign in again.
                                BubbleCredentialStore.clear(appContext)
                                Toast.makeText(appContext, "ContextOS needs to reconnect — open the app once, then try again.", Toast.LENGTH_LONG).show()
                            }
                            else ->
                                Toast.makeText(appContext, "Couldn't save. Check your connection.", Toast.LENGTH_LONG).show()
                        }
                    },
                )
            }
        }

        finish()
    }

    companion object {
        // Application-scoped, not activity-scoped — see the launch site above.
        private val saveScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    }
}
