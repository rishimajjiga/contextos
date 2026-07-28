package com.usecontextos.app.bubble

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.usecontextos.app.R
import com.usecontextos.app.util.Constants

private val BrandGreen = Color(0xFF4F9437)

/**
 * Floating Brain permission setup — grant the overlay permission, done. Reached two ways:
 *  1. WebAppBridge.enableBubble(), from the site's own "Enable Floating Brain" prompt
 *     (BubbleExtensionPrompts.tsx) — starts at the intro step.
 *  2. BubbleOnboardingSheet's "Enable" button, on first sign-in — the sheet already covered
 *     the intro, so this starts directly at the permission step (EXTRA_SKIP_INTRO).
 */
class BubbleSetupActivity : ComponentActivity() {

    private val overlaySettingsLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            // ACTION_MANAGE_OVERLAY_PERMISSION doesn't reliably return a meaningful result code —
            // the actual grant state is only knowable by asking Settings.canDrawOverlays() fresh.
            refreshPermissionState?.invoke()
        }

    private var refreshPermissionState: (() -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val granted = Settings.canDrawOverlays(this)
        val skipIntro = intent.getBooleanExtra(EXTRA_SKIP_INTRO, false)
        setContent {
            MaterialTheme {
                SetupFlow(
                    initialStep = if (granted) 3 else if (skipIntro) 2 else 1,
                    initiallyGranted = granted,
                    registerRefreshCallback = { refreshPermissionState = it },
                    onRequestPermission = {
                        overlaySettingsLauncher.launch(
                            Intent(
                                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                Uri.parse("package:$packageName"),
                            ),
                        )
                    },
                    onFinish = { enabled ->
                        if (enabled) {
                            getSharedPreferences(Constants.PREFS_NAME, MODE_PRIVATE)
                                .edit().putBoolean(Constants.PREF_BUBBLE_ENABLED, true).apply()
                            androidx.core.content.ContextCompat.startForegroundService(
                                this,
                                Intent(this, FloatingBubbleService::class.java),
                            )
                        }
                        finish()
                    },
                )
            }
        }
    }

    companion object {
        const val EXTRA_SKIP_INTRO = "skip_intro"
    }
}

@Composable
private fun SetupFlow(
    initialStep: Int,
    initiallyGranted: Boolean,
    registerRefreshCallback: (() -> Unit) -> Unit,
    onRequestPermission: () -> Unit,
    onFinish: (enabled: Boolean) -> Unit,
) {
    var step by remember { mutableIntStateOf(initialStep) }
    var granted by remember { mutableStateOf(initiallyGranted) }

    // Re-checked whenever the user returns from the system Settings screen — see
    // overlaySettingsLauncher above.
    val context = androidx.compose.ui.platform.LocalContext.current
    androidx.compose.runtime.LaunchedEffect(Unit) {
        registerRefreshCallback {
            val nowGranted = Settings.canDrawOverlays(context)
            granted = nowGranted
            if (nowGranted && step == 2) step = 3
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFFCFEFB)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            StepDots(step)
            Spacer(Modifier.height(32.dp))

            when (step) {
                1 -> SetupStep(
                    emoji = "🧠",
                    title = stringResource(R.string.bubble_setup_step1_title),
                    body = stringResource(R.string.bubble_setup_step1_body),
                    primaryLabel = stringResource(R.string.bubble_setup_continue),
                    onPrimary = { step = 2 },
                    onSkip = { onFinish(false) },
                )
                2 -> SetupStep(
                    emoji = "🔓",
                    title = stringResource(R.string.bubble_setup_step2_title),
                    body = stringResource(R.string.bubble_setup_step2_body),
                    primaryLabel = stringResource(R.string.bubble_setup_open_settings),
                    onPrimary = onRequestPermission,
                    onSkip = { onFinish(false) },
                )
                3 -> SetupStep(
                    emoji = "✅",
                    title = stringResource(R.string.bubble_setup_step3_title),
                    body = stringResource(R.string.bubble_setup_step3_body),
                    primaryLabel = stringResource(R.string.bubble_setup_finish),
                    // If this device is battery-optimized or an aggressive OEM, one more optional
                    // step helps the bubble survive — otherwise finish here.
                    onPrimary = {
                        val needsReliability = granted && (
                            BubbleReliabilityHelper.shouldOfferBatteryExemption(context) ||
                                BubbleReliabilityHelper.isAggressiveOem()
                            )
                        if (needsReliability) step = 4 else onFinish(granted)
                    },
                    onSkip = null,
                )
                else -> ReliabilityStep(
                    onAllowBattery = { BubbleReliabilityHelper.openBatterySettings(context) },
                    onOpenAppSettings = { BubbleReliabilityHelper.openAppSettings(context) },
                    onDone = {
                        BubbleReliabilityHelper.markBatteryPromptDismissed(context)
                        onFinish(granted)
                    },
                )
            }
        }
    }
}

/**
 * Optional final step (requirements 7 & 8): the battery-exemption ask plus, on aggressive OEM
 * skins, the auto-start guidance. Both actions open a system settings screen (Play-safe — no
 * REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission, no undocumented OEM intents). "Done" marks the
 * prompt dismissed so it never auto-nags again.
 */
@Composable
private fun ReliabilityStep(
    onAllowBattery: () -> Unit,
    onOpenAppSettings: () -> Unit,
    onDone: () -> Unit,
) {
    Box(
        modifier = Modifier
            .padding(bottom = 24.dp)
            .background(BrandGreen.copy(alpha = 0.12f), CircleShape)
            .padding(28.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = "🔋", fontSize = 40.sp)
    }
    Text(
        text = stringResource(R.string.bubble_battery_title),
        fontSize = 22.sp,
        fontWeight = FontWeight.SemiBold,
        color = Color(0xFF182A1B),
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(12.dp))
    Text(
        text = stringResource(R.string.bubble_battery_body),
        fontSize = 15.sp,
        color = Color(0xFF4A5A4D),
        textAlign = TextAlign.Center,
    )
    if (BubbleReliabilityHelper.isAggressiveOem()) {
        Spacer(Modifier.height(12.dp))
        Text(
            text = BubbleReliabilityHelper.oemInstructions(),
            fontSize = 13.sp,
            color = Color(0xFF6B7A6E),
            textAlign = TextAlign.Center,
        )
    }
    Spacer(Modifier.height(28.dp))
    Button(
        onClick = onAllowBattery,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = BrandGreen),
    ) {
        Text(stringResource(R.string.bubble_battery_button), modifier = Modifier.padding(vertical = 6.dp))
    }
    if (BubbleReliabilityHelper.isAggressiveOem()) {
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = onOpenAppSettings,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEAF1E4), contentColor = Color(0xFF2F6B34)),
        ) {
            Text(stringResource(R.string.bubble_oem_button), modifier = Modifier.padding(vertical = 6.dp))
        }
    }
    Spacer(Modifier.height(8.dp))
    TextButton(onClick = onDone) {
        Text(stringResource(R.string.bubble_setup_skip), color = Color(0xFF6B7A6E))
    }
}

@Composable
private fun StepDots(step: Int) {
    Column {
        Text(
            // Step 4 is the optional reliability step, shown only on some devices — labelling it
            // "4 of 3" would be nonsense, so it reads "Optional".
            text = if (step >= 4) "Optional" else "Step $step of 3",
            fontSize = 13.sp,
            color = Color(0xFF6B7A6E),
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun SetupStep(
    emoji: String,
    title: String,
    body: String,
    primaryLabel: String,
    onPrimary: () -> Unit,
    onSkip: (() -> Unit)?,
) {
    Box(
        modifier = Modifier
            .padding(bottom = 24.dp)
            .background(BrandGreen.copy(alpha = 0.12f), CircleShape)
            .padding(28.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = emoji, fontSize = 40.sp)
    }
    Text(
        text = title,
        fontSize = 22.sp,
        fontWeight = FontWeight.SemiBold,
        color = Color(0xFF182A1B),
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(12.dp))
    Text(
        text = body,
        fontSize = 15.sp,
        color = Color(0xFF4A5A4D),
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(32.dp))
    Button(
        onClick = onPrimary,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = BrandGreen),
    ) {
        Text(primaryLabel, modifier = Modifier.padding(vertical = 6.dp))
    }
    if (onSkip != null) {
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onSkip) {
            Text(stringResource(R.string.bubble_setup_skip), color = Color(0xFF6B7A6E))
        }
    }
}
