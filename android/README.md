# ContextOS Android app

A thin native host around the existing web app at **https://www.usecontextos.com/** — a
WebView, not a reimplementation. Nothing in `frontend/` or `backend/` needs to change for the
app to work, with one addition explained below (`assetlinks.json`).

- Package: `com.usecontextos.app`
- Min SDK 26 (Android 8.0) · Target/Compile SDK 35
- Kotlin, View Binding, no XML-free Compose — kept deliberately simple since the UI *is* the
  website; native code exists to host and integrate the WebView, not to render screens.

## Opening the project

1. Open `android/` (not the repo root) in Android Studio (Koala+ recommended).
2. Let it sync. Android Studio ships its own JDK and Gradle, so it will fetch the Gradle
   distribution and regenerate `gradle/wrapper/gradle-wrapper.jar` automatically — that binary
   isn't checked in (nothing meaningful to hand-author into it).
3. Run on a device/emulator. It will build and launch pointed at the real production site.

I could not execute an actual Gradle build in the sandbox this was generated in (no JDK
installed there), so treat the first Android Studio sync as the real compile check.

## Required before this is fully functional

The project **compiles and runs as-is** — it'll load the real site immediately. These four
things are the parts that need your own credentials/assets, which is unavoidable since they're
tied to accounts and keys only you have:

### 1. Firebase (push notifications)
`app/google-services.json` is a structurally-valid placeholder so the Gradle build doesn't
fail — it will not receive real messages.
1. Create a Firebase project → add an Android app with package `com.usecontextos.app`, and a
   second one with `com.usecontextos.app.debug` (the debug build type appends that suffix).
2. Download the real `google-services.json`, replace `app/google-services.json`.
3. That's it for receiving push — `ContextOSFirebaseMessagingService` auto-subscribes every
   install to the `all_users` FCM topic, so you can broadcast from the Firebase console with no
   backend changes. See that file's doc comment if you later want per-user targeted push (the
   backend doesn't have a device-token endpoint today, so that part is on you).

### 2. Release signing
```
keytool -genkey -v -keystore release.keystore.jks -alias contextos -keyalg RSA -keysize 2048 -validity 10000
cp keystore.properties.example keystore.properties   # fill in the real passwords
```
Keep `release.keystore.jks` and `keystore.properties` out of git (already gitignored). Losing
this keystore means you can never update the app under the same Play Store listing again —
back it up somewhere durable.

### 3. App icon
`res/drawable/ic_launcher_foreground.xml` and `ic_launcher_background.xml` are a placeholder
green monogram, not real brand art. Replace via Android Studio → New → Image Asset once you
have a real icon.

### 4. `assetlinks.json` (required for App Links + smoother Google/GitHub sign-in return)
I added `frontend/public/.well-known/assetlinks.json` — the standard, Google-documented way to
prove your Android app and your website are the same entity, so `https://www.usecontextos.com/…`
links open directly in the app instead of a browser. This is the one website change made, and
it's purely additive (a new static file); nothing else in the frontend was touched.
1. Get your signing certificate's SHA-256 fingerprint: `./gradlew signingReport` (needs the
   release config from step 2), or `keytool -list -v -keystore release.keystore.jks`.
2. Replace `REPLACE_WITH_YOUR_RELEASE_KEYSTORE_SHA256_FINGERPRINT` in that file with it.
3. Deploy the frontend (normal Vercel deploy) so the file is live at
   `https://www.usecontextos.com/.well-known/assetlinks.json`.
Until this is live, `android:autoVerify="true"` on the App Links intent filter simply won't
verify — the app still works, https links just won't auto-open it.

## Why some things aren't a plain 1:1 port

**Google Sign-In will not load inside a raw WebView.** Clerk's sign-in page (`SignInPage.tsx`)
offers "Continue with Google," and Google's OAuth consent screen actively refuses to render
inside embedded WebViews (`disallowed_useragent`) — this isn't a bug to route around, it's a
hard policy on Google's end. `AppWebViewClient` handles it correctly: any navigation off
`usecontextos.com` / Clerk's own auth domains (Google, GitHub, Stripe Checkout, wa.me, etc.)
opens in a Chrome Custom Tab instead of the embedded WebView, which Google explicitly allows.
Same mechanism handles `window.open()` popups (`AppWebChromeClient.onCreateWindow`).

**The foreground service is scoped, not always-on.** `KeepAliveService` only runs while a Live
Session is actively being presented — started by `ContextOSNative.startLiveSessionForeground()`,
which nothing calls yet today (it's there for the frontend's live-session module to call when
presenting starts, if you want the realtime connection to survive the screen turning off). It
always shows a dismissible notification with a Stop action, per policy. `BootReceiver` does the
bare minimum (re-confirm the FCM topic subscription) rather than starting anything.

**"Background Service" is WorkManager, not a raw `Service`.** A plain background `Service` gets
killed by the OS within minutes of the app leaving the foreground on any Android 8+ device — it
would pass a five-minute manual test and then quietly stop working for real users. `service/BackgroundSyncWorker.kt`
is the platform's actual replacement: a `CoroutineWorker` scheduled as periodic work (every 15
minutes, WorkManager's floor), constrained to require a network connection, and registered once
in `ContextOSApp.onCreate()`. It does one idempotent thing today — re-confirm the FCM topic
subscription — deliberately nothing that resembles the capture feature below.

**"Save to ContextOS" from any app (text-selection action) and the sign-in → backend API-key
handoff have both been removed, temporarily, as a diagnostic isolation step.** An earlier version
of this app had a `SYSTEM_ALERT_WINDOW` floating bubble (`WindowManager` overlay + foreground
service) that was removed first. On top of that, this app also had a lighter-weight
`android.intent.action.PROCESS_TEXT` handler (`selection/SaveSelectionActivity.kt`) that added
"Save to ContextOS" to the system text-selection toolbar in every app, backed by a native
sign-in watcher (`MainActivity` polling `window.Clerk` on `/dashboard` load, same pattern as the
connect-extension flow) that exchanged a fresh Clerk JWT for a long-lived backend API key
(`WebAppBridge.onSignedIn`/`onSignedOut`, stored via `util/SecurePrefs.kt`
EncryptedSharedPreferences). All of this — `selection/SaveSelectionActivity.kt`,
`bubble/BubbleApiClient.kt`, `util/SecurePrefs.kt`, the `onSignedIn`/`onSignedOut` bridge methods,
the `CLERK_WATCHER_SCRIPT` watcher in `MainActivity.kt`, the manifest activity entry, the
`Theme.ContextOS.Overlay` style, and the `androidx.security:security-crypto` dependency — has been
deleted while a persistent post-sign-in black-screen/freeze bug is root-caused, to rule out this
code as the cause. The plan is to reintegrate it once that's resolved; nothing here is a
permanent product decision.

### iOS — not implemented, scoped for later

System-wide floating overlays are an Android-only capability; there is no iOS equivalent, and
faking one would be misleading. The right iOS analog is a **Share Extension** ("Save to
ContextOS") plus an App Shortcut, so users can save selected text/links from any app via the
system share sheet — same backend, same branding, different OS mechanism. This needs, and does
not yet have:
- An actual iOS Xcode project (none exists in this repo today) with a Share Extension target.
- An App Group so the extension and the main app can share the Keychain-stored credential (iOS's
  equivalent of `SecurePrefs` — Keychain, not UserDefaults, for the same reason: never store an
  auth credential unencrypted).
- The same sign-in → long-lived-API-key handoff concept as Android, adapted to however the iOS
  app signs in (a native Clerk SDK integration, or a WKWebView-hosted sign-in with a similar
  injected-script handoff).
- Share-sheet UI matching the brand (green/white, rounded, ContextOS wordmark).

This is a real, separate build requiring a macOS/Xcode environment to create and verify — not
something to fabricate as unverified Swift files.

## Future capture feature — architecture, not implementation

The `capture/` package is scaffolding for "bring content into ContextOS from any app" — built
now so a real implementation later is additive, not a refactor, but with nothing that
auto-collects anything running today. Three pieces:

- `CapturedItem` / `CaptureSource` — the one shape every capture path produces, regardless of
  where it came from.
- `CaptureRepository` — the single hand-off point. Today it just hands the item to the user to
  paste on `/memories/new` (see `MainActivity.captureRepository`); it never calls the backend
  directly, keeping the website as the source of truth for actually saving anything.
- `ShareIntentCaptureSource` — the capture source that's **live today**: Android's Share sheet.
  Sharing text (or a PDF, per the manifest's intent filters) from any app into ContextOS already
  satisfies "capture from other apps" the fully Play-compliant way — no extra permission, no
  background activity, runs only because the user tapped Share and picked ContextOS.
- `capture/accessibility/CaptureAccessibilityServiceStub.kt` — the placeholder for the heavier
  version (reading on-screen content from whatever app is in the foreground, not just apps with
  a Share button). It is **not wired to anything** — no manifest `<service>` entry, no
  accessibility config resource, no permission declared. It cannot run as written. Read its doc
  comment before building the real thing: AccessibilityService is Google Play's most heavily
  reviewed permission category, must stay strictly user-triggered (never a running event
  listener), requires the user to manually enable it in system Settings, and needs a narrow
  declared use-case in Play Console or the listing gets rejected.

## What's implemented

WebView: JS, localStorage/sessionStorage/IndexedDB (`domStorageEnabled`), cookies (incl.
third-party, flushed on background so sessions survive restarts), file upload (system picker +
camera capture via FileProvider), camera/mic for WebRTC (`onPermissionRequest`), downloads (via
`DownloadManager`, carrying over cookies for authenticated exports), clipboard (default WebView
behavior, unrestricted), fullscreen video, geolocation, dark mode (`WebSettingsCompat`
algorithmic darkening follows system theme; the site's own CSS still drives actual appearance),
back navigation, external links / multiple windows (both routed through the Custom Tabs logic
above), pull-to-refresh, Safe Browsing, SSL-error hard-fail (never proceeds past a cert error).

Background/system integration: FCM push with a deep-linking tap action, a Stop action on the
Live Session notification, a Quick Settings tile ("New memory"), a boot receiver, periodic
background sync via WorkManager (`BackgroundSyncWorker`), network monitoring with a native
offline screen + retry, HTTPS-only via Network Security Config, App Links + a `contextos://`
custom scheme, receiving shared text/PDFs through the `capture` module (`ACTION_SEND` → copies to
clipboard and opens `/memories/new`, since the site has no query-param prefill today), and a
`ContextOSNative` JS bridge (`share`, `vibrate`, `getFcmToken`, the live-session methods, and
`onExtensionKeyExtracted` for the `/connect-extension` flow) that the site is free to ignore —
every method is additive, nothing requires frontend changes to keep working.
