package com.usecontextos.app.capture

/**
 * The single hand-off point every [CaptureSource] feeds into. Deliberately dumb: it does not
 * call the backend directly (the website remains the source of truth for saving a memory —
 * see android/README.md's development rules), it just routes a captured item to whatever the
 * app wants to do with it today (currently: hand it to the user to paste on `/memories/new`,
 * see [com.usecontextos.app.MainActivity]).
 *
 * This is the seam a future capture source plugs into without touching MainActivity: build the
 * new source, have it construct a [CapturedItem], call [handle]. Nothing else changes.
 */
fun interface CaptureRepository {
    fun handle(item: CapturedItem)
}
