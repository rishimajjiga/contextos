package com.usecontextos.app

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

/**
 * Uses the platform SplashScreen API (with an AndroidX compat shim for pre-12 devices)
 * so cold start shows the brand mark immediately instead of a blank white frame while
 * the WebView engine initializes.
 */
class SplashActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        val forward = Intent(this, MainActivity::class.java).apply {
            // Preserve deep-link / share data if the app was launched via one.
            intent.data?.let { data = it }
            intent.action?.let { action = it }
            intent.extras?.let { putExtras(it) }
            intent.type?.let { type = it }
        }
        startActivity(forward)
        finish()
    }
}
