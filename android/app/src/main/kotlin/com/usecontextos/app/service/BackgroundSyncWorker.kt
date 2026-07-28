package com.usecontextos.app.service

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import androidx.work.Constraints
import com.google.firebase.messaging.FirebaseMessaging
import com.usecontextos.app.fcm.ContextOSFirebaseMessagingService
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit

/**
 * The "Background Service" module. A raw unbounded `Service` cannot actually run in the
 * background on modern Android — Oreo's background-execution limits kill it within
 * minutes of the app leaving the foreground, so implementing that requirement literally
 * would look like it works in a five-minute test and then silently stop working for real
 * users. WorkManager is the platform's own replacement for exactly this case (periodic,
 * deferrable, survives reboots/process death, battery-aware), so that's what backs this
 * module instead. It intentionally does light, idempotent housekeeping only —
 * re-confirming the FCM topic subscription — never anything resembling the capture
 * feature (see the `capture` package for why that's a hard boundary).
 */
class BackgroundSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // Without a real google-services.json the subscribe call throws 100% of the time, and
        // returning retry() for a PERMANENT config condition made WorkManager backoff-retry this
        // job endlessly on top of its own 15-minute period — a battery/network drain and log-spam
        // loop on every install until Firebase is configured. Nothing to sync → success.
        if (!com.usecontextos.app.fcm.PushRegistrar.isFirebaseConfigured(applicationContext)) {
            return Result.success()
        }
        return try {
            FirebaseMessaging.getInstance().subscribeToTopic(ContextOSFirebaseMessagingService.TOPIC_ALL_USERS).await()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "contextos_background_sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            // 15 minutes is WorkManager's minimum interval for periodic work.
            val request = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }
}
