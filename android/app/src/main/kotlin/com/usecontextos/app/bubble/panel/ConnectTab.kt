package com.usecontextos.app.bubble.panel

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Divider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val SuccessGreen = Color(0xFF34D399)
private val DangerRed = Color(0xFFDC2626)
private val DangerBg = Color(0x1FEF4444) // rgba(239,68,68,0.12)

/**
 * Port of the extension's ctx-tc-connect tab. "Connect with ContextOS" reuses the app's
 * already-working /connect-extension key-extraction flow (see WebAppBridge.
 * onExtensionKeyExtracted) rather than a second, parallel OAuth implementation — the manual
 * fields below are the fallback for cases where that auto-detection path doesn't fire (a
 * self-hosted backend, or a Clerk session the auto-mint script hasn't caught yet).
 */
@Composable
fun ConnectTab(
    state: PanelState,
    onConnectWithContextOS: () -> Unit,
    onBackendUrlChange: (String) -> Unit,
    onApiKeyChange: (String) -> Unit,
    onSaveManual: () -> Unit,
    onTestManual: () -> Unit,
    onDisconnectRequest: () -> Unit,
    onDisconnectConfirm: () -> Unit,
    onDisconnectCancel: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
            Text(
                "CONNECT CONTEXTOS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PanelColors.muted(0.4f),
                modifier = Modifier.padding(bottom = 6.dp),
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Brush.linearGradient(listOf(PanelColors.Brand, PanelColors.Brand2)))
                    .clickableNoRipple(onConnectWithContextOS)
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("Connect with ContextOS →", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }

            Divider(color = PanelColors.Border, thickness = 1.dp, modifier = Modifier.padding(vertical = 14.dp))

            Text(
                "ADVANCED — MANUAL API SETUP",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = PanelColors.muted(0.35f),
                modifier = Modifier.padding(bottom = 6.dp),
            )
            PanelTextField(
                value = state.connectBackendUrlInput,
                placeholder = "http://localhost:8000",
                onValueChange = onBackendUrlChange,
                singleLine = true,
            )
            Spacer(Modifier.height(8.dp))
            PanelTextField(
                value = state.connectApiKeyInput,
                placeholder = "ctxos_…",
                onValueChange = onApiKeyChange,
                singleLine = true,
                masked = true,
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                GhostButton(label = "Save", modifier = Modifier.weight(1f), onClick = onSaveManual)
                GhostButton(
                    label = if (state.connectTesting) "Testing…" else "Test",
                    modifier = Modifier.weight(1f),
                    onClick = onTestManual,
                    enabled = !state.connectTesting,
                )
            }
            state.connectStatus?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = if (state.connectStatusIsError) DangerRed else SuccessGreen,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
            }

            if (state.isConnected) {
                Spacer(Modifier.height(14.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(DangerBg)
                        .clickableNoRipple(onDisconnectRequest)
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Disconnect", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = DangerRed)
                }
            }
        }

        if (state.showDisconnectConfirm) {
            DisconnectConfirmOverlay(onConfirm = onDisconnectConfirm, onCancel = onDisconnectCancel)
        }
    }
}

@Composable
private fun GhostButton(label: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(9.dp))
            .background(PanelColors.muted(0.08f))
            .let { if (enabled) it.clickableNoRipple(onClick) else it }
            .padding(vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PanelColors.muted(0.65f))
    }
}

/** In-panel confirmation rather than a separate system Dialog — a bare overlay Service window
 * already needs deliberate lifecycle wiring for Compose (see ComposeLifecycleOwner); adding a
 * second, real Android Dialog window on top of it is unnecessary complexity for a single
 * confirm/cancel step that fits fine inside the panel's own Compose tree. */
@Composable
private fun DisconnectConfirmOverlay(onConfirm: () -> Unit, onCancel: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(280.dp)
            .background(PanelColors.PanelBg.copy(alpha = 0.98f))
            .clickableNoRipple { }, // swallow taps so they don't fall through to content behind
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "Disconnect from ContextOS?",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PanelColors.TextStrong,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "Your data stays safe.",
                fontSize = 12.sp,
                color = PanelColors.muted(0.5f),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GhostButton(label = "Cancel", onClick = onCancel)
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(9.dp))
                        .background(DangerBg)
                        .clickableNoRipple(onConfirm)
                        .padding(horizontal = 20.dp, vertical = 9.dp),
                ) {
                    Text("Disconnect", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = DangerRed)
                }
            }
        }
    }
}
