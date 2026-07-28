package com.usecontextos.app.bubble.panel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color

/**
 * Theme-aware palette matching the ContextOS website as the user actually sees it in this app.
 *
 * Light values come from the site's own design tokens (frontend/tailwind.config.ts: surface-1
 * #f7faf2, foreground ~#182a1b, brand-500 #4f9437, brand scale). Dark values match the app's
 * existing dark set (res/values/colors.xml: background_dark #0F1610 / surface_dark #182A1B /
 * on_background_dark #E7F0E3) — which is what the WebView-rendered site looks like on this
 * device in dark mode, via the algorithmic darkening MainActivity enables. The panel following
 * the same day/night split is what makes it read as "part of the website" instead of a
 * light beige card floating over a dark app.
 *
 * `dark` is Compose state, set once per composition from isSystemInDarkTheme() at the panel/
 * bubble roots — every color read below subscribes to it, so a system theme change while the
 * bubble is alive recomposes everything correctly.
 */
object PanelColors {
    var dark by mutableStateOf(false)

    val Brand = Color(0xFF4F9437) // brand-500
    val Brand2 = Color(0xFF73B14F) // brand-400 — the site's gradients run brand-600→brand-400

    val PanelBg: Color get() = if (dark) Color(0xFF182A1B) else Color(0xFFF7FAF2)
    val TextStrong: Color get() = if (dark) Color(0xFFE7F0E3) else Color(0xFF1C2E1D)
    val TextEmail: Color get() = TextStrong.copy(alpha = 0.8f)

    // The recurring muted/border base — deep forest in light mode (the site's
    // "rgba(45, 70, 35, X)" pattern), pale sage in dark mode.
    private val MutedLight = Color(0xFF2D4623)
    private val MutedDark = Color(0xFFC9DCC4)
    fun muted(alpha: Float): Color = (if (dark) MutedDark else MutedLight).copy(alpha = alpha)
    val Border: Color get() = muted(if (dark) 0.22f else 0.32f)

    val StatusOn = Color(0xFF10B981)
    val StatusOff = Color(0xFF6B7280)
    val PlanText: Color get() = if (dark) Color(0xFF9AC978) else Color(0xFF2F6B34) // brand-300 / deep leaf
    val ErrorText = Color(0xFFF87171)
    val SuccessText = Color(0xFF6EE7B7)

    val AccountRowBg: Color get() = Brand.copy(alpha = if (dark) 0.12f else 0.06f)
    val PlanBadgeBg: Color get() = Brand.copy(alpha = if (dark) 0.22f else 0.14f)
    val PlanBadgeBorder = Color(0x4D4F9437) // rgba(79,148,55,0.3)
    val InjectBtnBg: Color get() = Brand.copy(alpha = if (dark) 0.25f else 0.15f)
    val InjectBtnBorder = Color(0x4D4F9437)
    val TabActiveBg: Color get() = Brand.copy(alpha = if (dark) 0.20f else 0.12f)
}
