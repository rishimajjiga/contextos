package com.usecontextos.app.util

import android.content.Context
import android.util.Log
import com.usecontextos.app.BuildConfig
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Diagnostic logging for DEVELOPERS. Logcat is written in every build (viewable only over `adb`,
 * never on-screen). The on-device log FILE — read back into MainActivity's debug dialog — is
 * written in DEBUG builds only, so a release/production install persists no readable log file and
 * surfaces nothing to users. A failure here is always swallowed; it never alters app behavior.
 */
object CrashLogger {
    private const val TAG = "ContextOSDebug"
    private const val LOG_FILE = "contextos_debug_log.txt"
    private const val MAX_LOG_BYTES = 200_000

    private var appContext: Context? = null

    /** Call once, as early as possible (Application.onCreate). */
    fun install(context: Context) {
        appContext = context.applicationContext
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching {
                val sw = StringWriter()
                throwable.printStackTrace(PrintWriter(sw))
                writeToFile("FATAL", "Uncaught exception on thread '${thread.name}':\n$sw")
            }
            // Always defer to whatever handler was there before (system default, or another
            // library's) — this only ever ADDS a log line, never changes crash behavior.
            previousHandler?.uncaughtException(thread, throwable)
        }
        d("CrashLogger", "installed")
    }

    fun d(tag: String, message: String) {
        // Debug-level lines routinely include full URLs (deep links, auth callback tickets) —
        // useful under a debugger, but nothing a production device should emit to logcat where
        // any adb-connected host can read it. Errors (below) stay logged in every build.
        if (BuildConfig.DEBUG) Log.d(TAG, "[$tag] $message")
        writeToFile("D/$tag", message)
    }

    fun e(tag: String, message: String, throwable: Throwable? = null) {
        Log.e(TAG, "[$tag] $message", throwable)
        val extra = throwable?.let { "\n" + it.stackTraceToString() } ?: ""
        writeToFile("E/$tag", message + extra)
    }

    private fun writeToFile(level: String, message: String) {
        // Release builds log to Logcat only (developer-accessible via adb) — never persist a
        // readable log file on a production device.
        if (!BuildConfig.DEBUG) return
        val context = appContext ?: return
        runCatching {
            val file = File(context.filesDir, LOG_FILE)
            if (file.exists() && file.length() > MAX_LOG_BYTES) file.delete()
            val timestamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
            file.appendText("$timestamp $level: $message\n")
        }
    }

    fun readLog(context: Context): String =
        runCatching { File(context.filesDir, LOG_FILE).takeIf { it.exists() }?.readText() }
            .getOrNull() ?: ""

    fun clearLog(context: Context) {
        runCatching { File(context.filesDir, LOG_FILE).delete() }
    }
}
