package com.usecontextos.app.capture

import android.content.Intent

/**
 * The capture source that's actually live today: Android's Share sheet. Any app with a
 * "Share" action can send text (or, per the manifest's SEND/SEND_MULTIPLE filters, a PDF or
 * other file) straight into ContextOS — this already satisfies "bring content in from other
 * apps" in the fully Android/Play-compliant way, with zero extra permissions and zero
 * background activity: it only ever runs because the user tapped Share, in the app they were
 * already using, and chose ContextOS from the system's own picker.
 */
object ShareIntentCaptureSource {
    /**
     * [referrerPackage] is best-effort: pass `activity.referrer?.host` when available (Android
     * only populates it for some sending apps) — never guessed from intent extras, which
     * aren't a reliable source of the sender's identity.
     */
    fun fromIntent(intent: Intent, referrerPackage: String? = null): CapturedItem? {
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.takeIf { it.isNotBlank() } ?: return null
        return CapturedItem(
            text = text,
            source = CaptureSource.SHARE_SHEET,
            sourceApp = referrerPackage,
        )
    }
}
