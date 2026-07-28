# ================================================================================================
# ContextOS release (R8/ProGuard) keep rules.
# Active only for the minified release build (keystore.properties present — see build.gradle.kts).
# Goal: nothing invoked reflectively or across the JS bridge gets stripped/renamed.
# ================================================================================================

# ---- WebView JS bridge -------------------------------------------------------------------------
# Every @JavascriptInterface method is called by name from page JavaScript, so names must survive.
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.usecontextos.app.webview.WebAppBridge { *; }

# ---- Firebase Cloud Messaging ------------------------------------------------------------------
-keep class com.google.firebase.messaging.** { *; }

# ---- OkHttp / Okio (network client for the bubble/selection/file API calls) --------------------
# OkHttp ships consumer rules, but pin the known R8 warnings/keeps explicitly.
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# ---- ML Kit text recognition (OCR) -------------------------------------------------------------
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_text_common.** { *; }
-dontwarn com.google.mlkit.**

# ---- PdfBox-Android (Tom Roush) — loads fonts/resources & uses reflection ----------------------
-keep class com.tom_roush.pdfbox.** { *; }
-keep class com.tom_roush.fontbox.** { *; }
-dontwarn com.tom_roush.**

# ---- org.json (used to parse API responses) ----------------------------------------------------
-keep class org.json.** { *; }

# ---- Kotlin coroutines / metadata --------------------------------------------------------------
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }
-dontwarn kotlinx.coroutines.**

# ---- Jetpack Compose --------------------------------------------------------------------------
# Compose ships its own consumer R8 rules; this only silences stray warnings.
-dontwarn androidx.compose.**

# ---- Enums (valueOf/values() used via when/reflection in a few places) --------------------------
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ---- Keep source-free crash lines readable in Play Console stack traces -------------------------
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
