package com.usecontextos.app.fcm

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.usecontextos.app.MainActivity
import com.usecontextos.app.R
import kotlin.random.Random

object NotificationHelper {

    /**
     * Shows a notification and, if [deepLinkUrl] is set, opens it in-app when tapped.
     * Pass a [stableId] (e.g. a notification id's hashCode) to make re-posting the SAME item
     * update the existing notification instead of stacking a duplicate — used by the inbox
     * poller. Omit it (default random) for one-off pushes where every message is distinct.
     */
    fun show(context: Context, title: String?, body: String?, deepLinkUrl: String?, stableId: Int? = null) {
        // Android 13+ notifications are opt-in; if the user declined POST_NOTIFICATIONS,
        // notify() is at best silently dropped — skip the work (and the lint violation) outright.
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        val notifyId = stableId ?: Random.nextInt()
        val tapIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            if (!deepLinkUrl.isNullOrBlank()) data = android.net.Uri.parse(deepLinkUrl)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            notifyId,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, context.getString(R.string.default_notification_channel_id))
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(context.getColor(R.color.brand_green))
            .setContentTitle(title ?: context.getString(R.string.app_name))
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(context).notify(notifyId, notification)
    }
}
