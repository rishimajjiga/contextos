package com.usecontextos.app.bubble.panel

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Port of #ctx-tc-save. The reference's placeholder text is "Save current page to your brain"
 * (a browser tab); the Android spec calls for "Save current screen/clip to your brain" instead,
 * since there's no "page" concept here — copy is the only intentional deviation from the
 * reference on this tab.
 */
@Composable
fun SaveTab(
    state: PanelState,
    onSaveClick: () -> Unit,
    onUpgradeClick: () -> Unit,
    onUploadFile: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp)) {
        Text(
            "SAVE TO YOUR BRAIN",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PanelColors.muted(0.4f),
            modifier = Modifier.padding(bottom = 6.dp),
        )

        PanelTextField(
            value = state.saveTitle,
            placeholder = "Title…",
            onValueChange = { state.saveTitle = it },
            singleLine = true,
        )
        androidx.compose.foundation.layout.Spacer(Modifier.height(6.dp))
        PanelTextField(
            value = state.saveContent,
            placeholder = "Content…",
            onValueChange = { state.saveContent = it },
            singleLine = false,
            minHeight = 54.dp,
        )
        androidx.compose.foundation.layout.Spacer(Modifier.height(6.dp))
        PanelTextField(
            value = state.saveTags,
            placeholder = "Tags (optional)",
            onValueChange = { state.saveTags = it },
            singleLine = true,
        )

        // "Share with team" — exact mechanism from the website's SaveMemoryPage.tsx: a checkbox
        // that sets visibility: "team" (vs the default "private"), shown only when the user is
        // actually on a team plan. This is also what fulfills the original ask for separate
        // "Save Personal Context" / "Save Team Context" actions — the website itself doesn't use
        // two buttons, it uses one Save button plus this toggle, so matching it exactly here
        // means matching that mechanism, not inventing a second button the reference doesn't have.
        if (state.hasTeam) {
            androidx.compose.foundation.layout.Spacer(Modifier.height(8.dp))
            androidx.compose.foundation.layout.Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(9.dp))
                    .background(PanelColors.muted(0.05f))
                    .border(1.dp, PanelColors.Border, RoundedCornerShape(9.dp))
                    .clickableNoRipple { state.saveShareTeam = !state.saveShareTeam }
                    .padding(horizontal = 11.dp, vertical = 9.dp),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                androidx.compose.material3.Checkbox(
                    checked = state.saveShareTeam,
                    onCheckedChange = { state.saveShareTeam = it },
                    colors = androidx.compose.material3.CheckboxDefaults.colors(checkedColor = PanelColors.Brand),
                )
                Column {
                    Text("👥 Share with team", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PanelColors.TextStrong)
                    Text(
                        "Visible to everyone in your organization.",
                        fontSize = 10.sp,
                        color = PanelColors.muted(0.5f),
                    )
                }
            }
        }
        androidx.compose.foundation.layout.Spacer(Modifier.height(8.dp))

        val canSave = !state.saving
        androidx.compose.foundation.layout.Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp),
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        ) {
            // Primary Save (fills remaining width)
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        if (canSave) Brush.linearGradient(listOf(PanelColors.Brand, PanelColors.Brand2))
                        else Brush.linearGradient(listOf(PanelColors.StatusOn, PanelColors.StatusOn)),
                    )
                    .clickableNoRipple { if (canSave) onSaveClick() }
                    .padding(vertical = 10.dp),
                contentAlignment = androidx.compose.ui.Alignment.Center,
            ) {
                Text(
                    if (state.saving) "Saving…" else "💾 Save to Brain",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
            }
            // Small "upload a file → extract text → save as memory" button. Opens the system
            // document picker (FilePickerActivity → FileTextExtractor → existing saveMemory).
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(PanelColors.muted(0.08f))
                    .border(1.dp, PanelColors.Border, RoundedCornerShape(10.dp))
                    .clickableNoRipple(onUploadFile)
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                contentAlignment = androidx.compose.ui.Alignment.Center,
            ) {
                Text("📎", fontSize = 14.sp)
            }
        }

        state.saveStatus?.let {
            Text(
                it,
                fontSize = 11.sp,
                color = if (state.saveStatusIsError) PanelColors.ErrorText else PanelColors.SuccessText,
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }

        // Same CTA the website shows at the memory limit (SaveMemoryPage's "⚡ Upgrade" → /plans).
        if (state.saveLimitReached) {
            androidx.compose.foundation.layout.Spacer(Modifier.height(6.dp))
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(9.dp))
                    .background(Brush.linearGradient(listOf(PanelColors.Brand, PanelColors.Brand2)))
                    .clickableNoRipple(onUpgradeClick)
                    .padding(vertical = 8.dp),
                contentAlignment = androidx.compose.ui.Alignment.Center,
            ) {
                Text("⚡ Upgrade", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

@Composable
fun PanelTextField(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
    singleLine: Boolean,
    minHeight: androidx.compose.ui.unit.Dp = 0.dp,
    masked: Boolean = false,
) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier
            .fillMaxWidth()
            .let { if (minHeight > 0.dp) it.height(minHeight) else it }
            .clip(RoundedCornerShape(9.dp))
            .background(PanelColors.muted(0.06f))
            .border(1.dp, PanelColors.Border, RoundedCornerShape(9.dp))
            .padding(horizontal = 11.dp, vertical = 8.dp),
    ) {
        if (value.isEmpty()) {
            Text(placeholder, fontSize = 12.sp, color = PanelColors.muted(0.25f))
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 12.sp, color = PanelColors.TextStrong),
            singleLine = singleLine,
            visualTransformation = if (masked) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
