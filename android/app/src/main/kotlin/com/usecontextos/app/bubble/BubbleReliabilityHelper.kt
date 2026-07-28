package com.usecontextos.app.bubble

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.usecontextos.app.util.Constants
import com.usecontextos.app.util.CrashLogger

/**
 * Battery-optimization + manufacturer-auto-start helpers for keeping the bubble alive
 * (requirements 7 & 8), all Play-Store-compliant:
 *
 *  - Battery: we OPEN the system battery-optimization settings list
 *    (ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS) rather than firing the direct
 *    ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS. The direct request needs the
 *    REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission, which Google Play restricts to a short list
 *    of eligible app categories; opening the settings screen needs no such permission and can't
 *    get an app rejected.
 *
 *  - Manufacturer: aggressive-OEM guidance is just text + a button that opens THIS app's system
 *    settings page (App info), from which the user can reach Auto-start / Battery on those skins.
 *    No hidden/undocumented OEM intents (which crash on devices that don't have them and look bad
 *    in review) — just a reliable, universal deep link plus instructions.
 *
 * "Don't nag": once the user dismisses the battery prompt we set a flag and never auto-show it
 * again (requirement 7); they can still reach it from the Restore/setup flow.
 */
object BubbleReliabilityHelper {

    /** OEM skins known for killing background overlays; guidance card is only shown on these. */
    private val AGGRESSIVE_OEMS = setOf(
        "xiaomi", "redmi", "poco", "vivo", "oppo", "realme", "huawei", "honor", "oneplus",
    )

    fun isBatteryOptimized(context: Context): Boolean {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
        return !pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun batteryPromptDismissed(context: Context): Boolean =
        context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(PREF_BATTERY_PROMPT_DISMISSED, false)

    fun markBatteryPromptDismissed(context: Context) {
        context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean(PREF_BATTERY_PROMPT_DISMISSED, true).apply()
    }

    /** True only when it's worth showing the battery card: optimized AND not previously dismissed. */
    fun shouldOfferBatteryExemption(context: Context): Boolean =
        isBatteryOptimized(context) && !batteryPromptDismissed(context)

    fun openBatterySettings(context: Context) {
        // The settings LIST (Play-safe), not the direct per-app request dialog.
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
            .onFailure {
                CrashLogger.e("Bubble", "battery settings intent failed — falling back to app info", it)
                openAppSettings(context)
            }
        CrashLogger.d("Bubble", "Opened battery optimization settings")
    }

    fun isAggressiveOem(): Boolean = Build.MANUFACTURER?.lowercase() in AGGRESSIVE_OEMS

    /** Per-OEM one-liner instructions surfaced with the guidance card. */
    fun oemInstructions(): String = when (Build.MANUFACTURER?.lowercase()) {
        "xiaomi", "redmi", "poco" ->
            "In App info → enable Autostart, set Battery saver to “No restrictions,” and lock ContextOS in Recents."
        "vivo", "oppo", "realme" ->
            "In App info → allow Auto-start and Background activity, and set battery usage to “Don’t optimize.”"
        "huawei", "honor" ->
            "In App info → App launch → turn off “Manage automatically,” then allow Auto-launch, Secondary launch, and Run in background."
        "oneplus" ->
            "In App info → Battery → “Don’t optimize,” and disable “Deep optimization” / “Sleep standby” for ContextOS."
        else ->
            "In App info → allow Auto-start / background activity and remove battery restrictions for ContextOS."
    }

    /** App-info page — reachable on every device; the launchpad for OEM auto-start/battery screens. */
    fun openAppSettings(context: Context) {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
            .onFailure { CrashLogger.e("Bubble", "app settings intent failed", it) }
    }

    private const val PREF_BATTERY_PROMPT_DISMISSED = "bubble_battery_prompt_dismissed"
}
