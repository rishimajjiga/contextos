package com.usecontextos.app.bubble

import android.content.Context
import android.provider.Settings
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import com.usecontextos.app.util.Constants
import com.usecontextos.app.util.CrashLogger
import java.util.concurrent.TimeUnit

/**
 * Periodic safety net (requirement 3): every ~15 minutes — the shortest interval WorkManager
 * allows — verify that if the user wants the bubble AND overlay permission is granted, the
 * foreground service is actually running. If it isn't (Android killed it and START_STICKY /
 * onTaskRemoved / onDestroy restart all somehow didn't bring it back), start it again.
 *
 * This is the backstop that makes the bubble Messenger-chat-head reliable across battery-saver
 * and low-memory kills. It only ever runs while the user has the bubble enabled (scheduled in
 * WebAppBridge.enableBubble, cancelled in disableBubble), so it does no work — and consumes no
 * battery beyond the check — for users who never turned the bubble on.
 *
 * Starting a foreground service from this background context is permitted because the app holds
 * SYSTEM_ALERT_WINDOW (overlay permission), which exempts it from Android 12+ background-FGS-start
 * restrictions — the same permission the bubble already requires to draw at all.
 */
class BubbleHealthWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val ctx = applicationContext
        val prefs = ctx.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        val wanted = prefs.getBoolean(Constants.PREF_BUBBLE_ENABLED, false)

        if (!wanted) {
            // User disabled it since we were scheduled — stand down (belt-and-suspenders; enable/
            // disable already schedule/cancel us).
            cancel(ctx)
            return Result.success()
        }
        if (!Settings.canDrawOverlays(ctx)) {
            CrashLogger.d("BubbleHealth", "Wanted but overlay permission missing — not restarting")
            return Result.success()
        }
        if (FloatingBubbleService.isRunning) {
            return Result.success() // healthy
        }

        CrashLogger.d("BubbleHealth", "Recovery: bubble wanted + permitted but service not running — restarting")
        FloatingBubbleService.startIfEnabled(ctx)
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "contextos_bubble_health"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<BubbleHealthWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.NONE) // must run even in battery-saver to recover
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                // KEEP: don't reset the 15-min clock every time enable is tapped.
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
            CrashLogger.d("BubbleHealth", "Health worker scheduled")
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            CrashLogger.d("BubbleHealth", "Health worker cancelled")
        }
    }
}
