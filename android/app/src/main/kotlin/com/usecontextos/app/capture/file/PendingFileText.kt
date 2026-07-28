package com.usecontextos.app.capture.file

/**
 * A one-shot in-memory hand-off for extracted file text going from FilePickerActivity back to
 * FloatingBubbleService (the bubble "📎" upload → preview flow). Deliberately NOT passed through
 * the launching Intent's extras: extracted text can easily exceed the ~1 MB Binder transaction
 * limit (a large PDF), which would crash the start. A process-local holder sidesteps that. It's
 * read-once (consume() clears it) so stale text can never leak into a later save.
 */
object PendingFileText {
    @Volatile
    private var title: String? = null

    @Volatile
    private var content: String? = null

    fun set(title: String, content: String) {
        this.title = title
        this.content = content
    }

    /** Returns and clears the pending {title, content}, or null if there's nothing waiting. */
    fun consume(): Pair<String, String>? {
        val t = title
        val c = content
        title = null
        content = null
        return if (t != null && c != null) t to c else null
    }
}
