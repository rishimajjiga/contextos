package com.usecontextos.app.bubble

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.usecontextos.app.R

private val BrandGreen = Color(0xFF4F9437)
private val BrandGreenBright = Color(0xFF5FB544) // slightly brighter for the glow, reads on dark too

// Resting vs touched. Resting is now clearly visible (not the near-invisible 20% that users
// missed) but still translucent enough that it never feels like a solid, intrusive disc; touch
// snaps it fully solid. This drives the CARD/border/glow only — the icon stays crisp regardless.
private const val RESTING_CARD_ALPHA = 0.40f
private const val ACTIVE_CARD_ALPHA = 1f

/**
 * The floating brain FAB — a white/dark rounded-square card with the brand brain-circuit icon.
 *
 * Tuned for "always noticeable, never intrusive": the ICON is drawn at full opacity at all times
 * (crisp, high-contrast on any background), while the CARD behind it is semi-opaque at rest and
 * solid on touch. A soft green glow (colored elevation shadow) plus a strengthened green border
 * give it a consistent edge against light, dark, colorful, AND image-heavy backgrounds — the
 * green outline is what makes it read on a busy photo where a plain white/dark card would vanish.
 */
@Composable
fun BubbleContent(pressed: Boolean, modifier: Modifier = Modifier) {
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.92f else 1f,
        animationSpec = tween(durationMillis = 120),
        label = "bubble-press-scale",
    )
    // Card opacity only — see the class comment. `pressed` flips true on ACTION_DOWN
    // (FloatingBubbleService.dragListener), so the card solidifies the instant you touch it.
    val cardAlpha by animateFloatAsState(
        targetValue = if (pressed) ACTIVE_CARD_ALPHA else RESTING_CARD_ALPHA,
        animationSpec = tween(durationMillis = 200),
        label = "bubble-card-alpha",
    )

    val isDark = isSystemInDarkTheme()
    val baseBg = if (isDark) Color(0xFF182A1B) else Color(0xFFFFFFFF)
    val cardBg = baseBg.copy(alpha = cardAlpha)

    // Border stays strongly visible even at rest (floored well above zero) so the green outline
    // never disappears — this is the single most important element for visibility on busy/photo
    // backgrounds. 2dp, and it firms up further on touch.
    val borderColor = BrandGreen.copy(alpha = 0.60f + 0.35f * cardAlpha)

    // Root fills the (slightly enlarged) overlay window and centres the visible card, leaving a
    // transparent margin all around so the green glow can render without being clipped by the
    // window edge. The visible/tappable card stays 44dp — its size is unchanged; only the window
    // grew to make room for the halo.
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .scale(scale)
                // Soft green outer glow — a brand-colored elevation shadow. A gentle halo that
                // separates the bubble from whatever's underneath on any background. (Colored
                // shadows render on API 28+; below that it falls back to a neutral shadow.)
                .shadow(
                    elevation = if (pressed) 14.dp else 10.dp,
                    shape = RoundedCornerShape(15.dp),
                    ambientColor = BrandGreenBright.copy(alpha = 0.55f),
                    spotColor = BrandGreenBright.copy(alpha = 0.65f),
                )
                .background(cardBg, RoundedCornerShape(15.dp))
                .border(2.dp, borderColor, RoundedCornerShape(15.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Image(
                painter = painterResource(R.drawable.ic_brain_circuit),
                contentDescription = "ContextOS",
                modifier = Modifier.size(23.dp), // full opacity — always crisp / high contrast
            )
        }
    }
}

/** Wraps BubbleContent in MaterialTheme so material3 defaults resolve correctly without pulling
 * in the app's full theme (this view has no Activity theme to inherit from). */
@Composable
fun BubbleRoot(pressed: Boolean) {
    MaterialTheme {
        BubbleContent(pressed = pressed)
    }
}
