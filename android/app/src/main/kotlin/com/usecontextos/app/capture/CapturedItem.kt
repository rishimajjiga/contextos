package com.usecontextos.app.capture

/** Where a [CapturedItem] originated. New sources are additive — see package doc. */
enum class CaptureSource {
    /** Android's standard Share sheet (`ACTION_SEND`/`ACTION_SEND_MULTIPLE`) — implemented today. */
    SHARE_SHEET,

    /**
     * A future, explicitly user-enabled AccessibilityService reading on-screen content from
     * whichever app is in the foreground when the user triggers a capture — NOT implemented,
     * see [com.usecontextos.app.capture.accessibility.CaptureAccessibilityServiceStub].
     */
    ACCESSIBILITY_SERVICE,
}

/**
 * A single piece of content a user explicitly chose to bring into ContextOS, regardless of
 * which [CaptureSource] it came from. This is the one shape every capture path produces, so
 * [CaptureRepository] — and everything downstream of it — never needs to know which source a
 * given item came from.
 */
data class CapturedItem(
    val text: String,
    val source: CaptureSource,
    /** Package name of the app the content came from, when the source can determine it. */
    val sourceApp: String? = null,
    val capturedAtMillis: Long = System.currentTimeMillis(),
)
