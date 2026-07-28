import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

// Signing config is optional for debug builds. For release, provide a
// keystore.properties file (see android/README.md) — never commit real
// signing secrets.
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) load(keystorePropsFile.inputStream())
}

android {
    namespace = "com.usecontextos.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.usecontextos.app"
        // 26 (Android 8.0, Aug 2017) — lets every device target the adaptive-icon-only
        // launcher format below and use notification channels unconditionally.
        minSdk = 26
        // 36 (Android 16): required for all new apps / updates submitted after Aug 31, 2026.
        // Edge-to-edge is enforced with no opt-out at this level — handled in MainActivity's
        // window-insets listener (see onCreate).
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "BASE_URL", "\"https://www.usecontextos.com/\"")
        buildConfigField("String", "APP_HOST", "\"www.usecontextos.com\"")
        resValue("string", "app_host", "www.usecontextos.com")
    }

    signingConfigs {
        if (keystorePropsFile.exists()) {
            create("release") {
                storeFile = file(keystoreProps["storeFile"] as String)
                storePassword = keystoreProps["storePassword"] as String
                keyAlias = keystoreProps["keyAlias"] as String
                keyPassword = keystoreProps["keyPassword"] as String
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
        release {
            // A REAL release (keystore.properties present) shrinks + obfuscates and signs with the
            // release key. Without a release keystore this is a TEST release: sign with the debug
            // key so it's installable, and skip minification so incomplete ProGuard rules can't
            // silently break the @JavascriptInterface bridge / ML Kit / PdfBox / OkHttp at runtime.
            // Either way BuildConfig.DEBUG is false, so all developer UI (crash dialog, WebView
            // remote debugging, on-device log file) stays off — the point of a production build.
            // Before shipping to Play, add keystore.properties and verify the minified build.
            val hasReleaseKeystore = keystorePropsFile.exists()
            isMinifyEnabled = hasReleaseKeystore
            isShrinkResources = hasReleaseKeystore
            if (hasReleaseKeystore) {
                proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
                signingConfig = signingConfigs.getByName("release")
            } else {
                signingConfig = signingConfigs.getByName("debug")
            }
        }
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
        compose = true
    }

    // Kotlin 1.9.24 predates the Kotlin-bundled Compose compiler (that merge landed in
    // Kotlin 2.0) — on this Kotlin version the compiler extension is still a separate,
    // manually-pinned artifact. 1.5.14 is the version built against 1.9.24; see
    // https://developer.android.com/jetpack/androidx/releases/compose-kotlin
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources.excludes.add("META-INF/*")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.activity:activity-compose:1.9.1")

    // Floating Brain bubble + expanded panel UI. A bare WindowManager overlay (the
    // bubble's host) has no Activity/Fragment lifecycle of its own — ComposeView needs
    // one wired up manually via lifecycle-viewmodel-compose's SavedStateRegistry/
    // ViewModelStore owners (see FloatingBubbleService.kt) or Compose refuses to render.
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.4")
    implementation("androidx.savedstate:savedstate-ktx:1.2.1")
    // Background Service module — see service/BackgroundSyncWorker.kt for why this
    // is WorkManager rather than a raw Service (OS background-execution limits).
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")

    // Floating Brain panel: native backend calls (memories/projects/search) with the
    // same ctxos_ API key the Chrome extension uses — see bubble/data/ContextOSApi.kt.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    // Encrypted-at-rest storage for that API key, per the security requirement — a plain
    // SharedPreferences file is otherwise just... a plain-text file.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // File capture → raw text extraction (see capture/file/FileTextExtractor.kt):
    //   PDF text  → PdfBox-Android (Tom Roush port; needs PDFBoxResourceLoader.init once)
    //   Image OCR → ML Kit on-device text recognition (bundles the Latin model → ~few MB APK
    //               growth; the reason the debug APK jumps in size)
    //   DOCX/PPTX/TXT need no library — handled with java.util.zip + plain XML text extraction.
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")
    // UNBUNDLED ML Kit OCR — the model ships via Google Play Services and downloads on first use,
    // rather than being bundled in the APK. Chosen over com.google.mlkit:text-recognition
    // (bundled) to keep the APK/build footprint small (the bundled model AAR is large and its
    // build-time extraction needs significant temp disk).
    implementation("com.google.android.gms:play-services-mlkit-text-recognition:19.0.0")

    // Firebase Cloud Messaging (requires a real google-services.json — see android/README.md)
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging-ktx")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
