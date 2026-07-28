package com.usecontextos.app.capture.accessibility

/**
 * ================================================================================
 *  NOT A LIVE FEATURE. Deliberately not registered anywhere — see below.
 * ================================================================================
 *
 * This is the architectural placeholder for "let the user pull content into ContextOS
 * from any app, not just ones with a Share button" — the capability requested for a
 * future release. It is intentionally *not* a working AccessibilityService: there is no
 * `<service>` entry for this class in AndroidManifest.xml, no accessibility_service_config
 * XML resource, and no BIND_ACCESSIBILITY_SERVICE permission declared. As written, this
 * class cannot run. That's the point — the architecture exists so the real
 * implementation is additive later, not so it works today.
 *
 * When this is actually built, it must follow every one of these rules:
 *
 * 1. USER-INITIATED ONLY. An AccessibilityService technically *can* run continuously and
 *    read every screen the user visits — that is exactly what makes it Google Play's most
 *    heavily reviewed permission category, and exactly what this project must never do.
 *    The service should sit idle (no-op on every AccessibilityEvent) until the user
 *    performs an explicit action — e.g. taps a floating capture affordance (see the
 *    already-built `bubble` module) or a notification action — and even then should only
 *    read the screen ONCE, for that one capture, then go back to idle. No event stream
 *    should ever be logged, stored, or transmitted.
 *
 * 2. MANUAL ENABLEMENT. Android requires the user to enable an AccessibilityService by
 *    hand in system Settings (it cannot be silently turned on by the app), and shows a
 *    system warning dialog about what the permission grants. Do not attempt to route
 *    around this or make the settings deep-link feel mandatory — this feature must be
 *    optional and clearly explained before the user is sent to that screen.
 *
 * 3. NARROW DECLARED PURPOSE. Play Console requires accessibility services to declare a
 *    single permitted use-case category (Play's policy center lists them) and demonstrate
 *    the service does only that. "Capture user-selected text on demand" is a defensible
 *    category; broad screen-reading or content indexing is not and will get the listing
 *    rejected.
 *
 * 4. FEEDS THE SAME SEAM. When implemented, this class should construct a
 *    [com.usecontextos.app.capture.CapturedItem] with
 *    `source = CaptureSource.ACCESSIBILITY_SERVICE` and hand it to the app's
 *    [com.usecontextos.app.capture.CaptureRepository] — the exact same object the Share-sheet
 *    path already uses. No other code in the app should need to change.
 *
 * Until all four of the above are true, this stays an empty file with no manifest entry.
 * ================================================================================
 */
internal object CaptureAccessibilityServiceStub
