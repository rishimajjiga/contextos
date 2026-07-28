package com.usecontextos.app.bubble

import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.google.android.material.bottomsheet.BottomSheetDialog

private val BrandGreen = Color(0xFF4F9437)

/**
 * Shown exactly once, the moment a Clerk session is first detected on this device (see
 * WebAppBridge.onBubbleKeyMinted) — not tied to the website's own "Enable Floating Brain"
 * prompt (BubbleExtensionPrompts.tsx), which is a separate, still-functional entry point.
 */
object BubbleOnboardingSheet {

    /** Guards against showing over a finishing/destroyed Activity (e.g. the JS callback lands
     * just as the user backs out of the app). */
    fun showIfResumed(activity: AppCompatActivity) {
        if (activity.isFinishing || activity.isDestroyed) return
        show(activity)
    }

    private fun show(activity: AppCompatActivity) {
        val dialog = BottomSheetDialog(activity)
        val composeView = ComposeView(activity).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            // A bare BottomSheetDialog's window doesn't automatically inherit the host
            // Activity's tree owners the way a view in the Activity's own content view does —
            // borrow them directly since a real Activity (unlike FloatingBubbleService's bare
            // overlay window) already has all three.
            setViewTreeLifecycleOwner(activity)
            setViewTreeViewModelStoreOwner(activity)
            setViewTreeSavedStateRegistryOwner(activity)
            setContent {
                MaterialTheme {
                    OnboardingContent(
                        onEnable = {
                            dialog.dismiss()
                            activity.startActivity(
                                Intent(activity, BubbleSetupActivity::class.java)
                                    .putExtra(BubbleSetupActivity.EXTRA_SKIP_INTRO, true),
                            )
                        },
                        onNotNow = { dialog.dismiss() },
                    )
                }
            }
        }
        dialog.setContentView(composeView)
        dialog.show()
    }
}

@Composable
private fun OnboardingContent(onEnable: () -> Unit, onNotNow: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .padding(bottom = 16.dp)
                .background(BrandGreen.copy(alpha = 0.12f), CircleShape)
                .padding(20.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "🧠", fontSize = 32.sp)
        }
        Text(
            text = "Enable the ContextOS Bubble",
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFF182A1B),
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Save and search your memories from any app — Chrome, ChatGPT, and more.",
            fontSize = 14.sp,
            color = Color(0xFF4A5A4D),
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onEnable,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandGreen),
        ) {
            Text("Enable", modifier = Modifier.padding(vertical = 6.dp))
        }
        Spacer(Modifier.height(4.dp))
        TextButton(onClick = onNotNow) {
            Text("Not now", color = Color(0xFF6B7A6E))
        }
    }
}
