package com.usecontextos.app.bubble.panel

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.usecontextos.app.bubble.data.BubbleProject

/**
 * Pixel-matched port of extension/content.js's #ctx-panel — same header, account row, tabs,
 * footer, and auto-suggest row structure and colors (see PanelColors.kt). Hosted inside
 * FloatingBubbleService's overlay window; state lives in PanelState so switching tabs or
 * closing/reopening doesn't lose in-flight data (same as the extension's module-level caches).
 */
@Composable
fun BubblePanel(
    state: PanelState,
    onClose: () -> Unit,
    onTabSelected: (PanelTab) -> Unit,
    onSaveClick: () -> Unit,
    onUpgradeClick: () -> Unit,
    onUploadFile: () -> Unit,
    onMemoryQueryChange: (String) -> Unit,
    onSearchQueryChange: (String) -> Unit,
    onUseMemory: (String) -> Unit,
    onUseProject: (BubbleProject) -> Unit,
    onOpenProject: (BubbleProject) -> Unit,
    onOpenApp: () -> Unit,
    onConnectWithContextOS: () -> Unit,
    onConnectBackendUrlChange: (String) -> Unit,
    onConnectApiKeyChange: (String) -> Unit,
    onSaveManualConnect: () -> Unit,
    onTestManualConnect: () -> Unit,
    onDisconnectRequest: () -> Unit,
    onDisconnectConfirm: () -> Unit,
    onDisconnectCancel: () -> Unit,
) {
    // Follow the device theme the same way the WebView-rendered site does (algorithmic
    // darkening in dark mode) — this is what makes the panel read as part of the website.
    PanelColors.dark = androidx.compose.foundation.isSystemInDarkTheme()
    MaterialTheme(
        colorScheme = if (PanelColors.dark) androidx.compose.material3.darkColorScheme(primary = PanelColors.Brand)
        else androidx.compose.material3.lightColorScheme(primary = PanelColors.Brand),
    ) {
        Surface(
            // Width is owned by the overlay window itself (FloatingBubbleService.PANEL_WIDTH_DP) —
            // fill it rather than double-specifying a second, competing width here.
            modifier = Modifier.fillMaxWidth(),
            color = PanelColors.PanelBg,
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(1.dp, PanelColors.Border),
            shadowElevation = 24.dp,
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                PanelHeader(state = state, onClose = onClose)
                if (state.accountLoaded && state.email != null) {
                    AccountRow(state)
                }
                TabsRow(active = state.activeTab, onTabSelected = onTabSelected)

                Box(modifier = Modifier.fillMaxWidth()) {
                    when (state.activeTab) {
                        PanelTab.SAVE -> SaveTab(state = state, onSaveClick = onSaveClick, onUpgradeClick = onUpgradeClick, onUploadFile = onUploadFile)
                        PanelTab.MEMORIES -> MemoryTab(
                            state = state,
                            onQueryChange = onMemoryQueryChange,
                            onUse = onUseMemory,
                            onViewAll = onOpenApp,
                        )
                        PanelTab.PROJECTS -> ProjectsTab(
                            state = state,
                            onUse = onUseProject,
                            onOpen = onOpenProject,
                        )
                        PanelTab.SEARCH -> SearchTab(
                            state = state,
                            onQueryChange = onSearchQueryChange,
                            onUseMemory = onUseMemory,
                            onUseProject = onUseProject,
                        )
                        PanelTab.CONNECT -> ConnectTab(
                            state = state,
                            onConnectWithContextOS = onConnectWithContextOS,
                            onBackendUrlChange = onConnectBackendUrlChange,
                            onApiKeyChange = onConnectApiKeyChange,
                            onSaveManual = onSaveManualConnect,
                            onTestManual = onTestManualConnect,
                            onDisconnectRequest = onDisconnectRequest,
                            onDisconnectConfirm = onDisconnectConfirm,
                            onDisconnectCancel = onDisconnectCancel,
                        )
                    }
                }

                Divider(color = PanelColors.Border, thickness = 1.dp)
                PanelFooter(onFullSaveDialog = onOpenApp, onSidebar = onOpenApp)
            }
        }
    }
}

@Composable
private fun PanelHeader(state: PanelState, onClose: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(listOf(PanelColors.Brand.copy(alpha = 0.12f), Color.Transparent)),
            )
            .padding(start = 14.dp, end = 14.dp, top = 13.dp, bottom = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("🧠", fontSize = 18.sp)
        Spacer(Modifier.width(8.dp))
        Text(
            "ContextOS",
            fontSize = 13.sp,
            fontWeight = FontWeight.ExtraBold,
            color = PanelColors.TextStrong,
            modifier = Modifier.weight(1f),
        )
        // Platform badge — full per-foreground-app detection needs UsageStatsManager (a
        // separate special permission, out of scope for this phase) or, for the specific case
        // of a "Save to ContextOS" launch, the calling package Android already hands over via
        // ACTION_PROCESS_TEXT (wired up in the text-selection phase). Static label for a plain
        // bubble tap in the meantime, same accent-badge styling as the reference.
        PlatformBadge(name = "Android", accent = PanelColors.Brand)
        Spacer(Modifier.width(8.dp))
        StatusDot(online = state.isOnline)
        Spacer(Modifier.width(6.dp))
        Text(
            "×",
            fontSize = 18.sp,
            color = PanelColors.muted(0.35f),
            modifier = Modifier.clickableNoRipple(onClose),
        )
    }
}

@Composable
private fun PlatformBadge(name: String, accent: Color) {
    Box(
        modifier = Modifier
            .background(accent.copy(alpha = 0.13f), RoundedCornerShape(99.dp))
            .border(1.dp, accent.copy(alpha = 0.27f), RoundedCornerShape(99.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Text(name, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = accent)
    }
}

@Composable
private fun StatusDot(online: Boolean) {
    Box(
        modifier = Modifier
            .width(7.dp)
            .height(7.dp)
            .background(if (online) PanelColors.StatusOn else PanelColors.StatusOff, CircleShape),
    )
}

@Composable
private fun AccountRow(state: PanelState) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(PanelColors.AccountRowBg)
            .padding(horizontal = 14.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("👤", fontSize = 11.sp)
        Spacer(Modifier.width(6.dp))
        Text(
            state.email.orEmpty(),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PanelColors.TextEmail,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (state.hasTeam) {
            Spacer(Modifier.width(6.dp))
            Text("👥", fontSize = 11.sp)
        }
        state.planLabel?.let { plan ->
            Spacer(Modifier.width(6.dp))
            Box(
                modifier = Modifier
                    .background(PanelColors.PlanBadgeBg, RoundedCornerShape(8.dp))
                    .border(1.dp, PanelColors.PlanBadgeBorder, RoundedCornerShape(8.dp))
                    .padding(horizontal = 6.dp, vertical = 1.dp),
            ) {
                Text(plan, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = PanelColors.PlanText)
            }
        }
    }
}

@Composable
private fun TabsRow(active: PanelTab, onTabSelected: (PanelTab) -> Unit) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(PanelColors.PanelBg)
                .padding(start = 10.dp, end = 10.dp, top = 8.dp),
        ) {
            PanelTab.values().forEach { tab ->
                val isActive = tab == active
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
                        .background(if (isActive) PanelColors.TabActiveBg else Color.Transparent)
                        .clickableNoRipple { onTabSelected(tab) }
                        .padding(vertical = 7.dp, horizontal = 4.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        if (tab.label != null) "${tab.emoji} ${tab.label.uppercase()}" else tab.emoji,
                        fontSize = if (tab.label != null) 10.sp else 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isActive) PanelColors.PlanText else PanelColors.muted(0.4f),
                        maxLines = 1,
                    )
                }
            }
        }
        Divider(color = PanelColors.Border, thickness = 1.dp, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun PanelFooter(onFullSaveDialog: () -> Unit, onSidebar: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(PanelColors.PanelBg)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .clip(RoundedCornerShape(10.dp))
                .background(Brush.linearGradient(listOf(PanelColors.Brand, PanelColors.Brand2)))
                .clickableNoRipple(onFullSaveDialog)
                .padding(vertical = 9.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("✨ Full Save Dialog", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(PanelColors.muted(0.07f))
                .border(1.dp, PanelColors.Border, RoundedCornerShape(10.dp))
                .clickableNoRipple(onSidebar)
                .padding(horizontal = 12.dp, vertical = 9.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("Sidebar →", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PanelColors.muted(0.55f))
        }
    }
}
