package com.usecontextos.app.bubble.panel

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.usecontextos.app.bubble.data.BubbleMemory
import com.usecontextos.app.bubble.data.BubbleProject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

private val TYPE_ICON = mapOf(
    "note" to "📝", "code" to "💻", "reference" to "🔗", "idea" to "💡",
    "research" to "🔬", "prompt" to "⚙️", "pdf" to "📄",
)

fun formatRelativeTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        val date = fmt.parse(iso.take(19)) ?: return ""
        val diffMs = System.currentTimeMillis() - date.time
        val diffSec = TimeUnit.MILLISECONDS.toSeconds(diffMs)
        when {
            diffSec < 60 -> "just now"
            diffSec < 3600 -> "${diffSec / 60}m ago"
            diffSec < 86400 -> "${diffSec / 3600}h ago"
            diffSec < 604800 -> "${diffSec / 86400}d ago"
            else -> SimpleDateFormat("MMM d", Locale.US).format(date)
        }
    } catch (e: Exception) {
        ""
    }
}

fun projectEmoji(name: String?): String {
    val n = name.orEmpty().lowercase()
    return when {
        "web" in n || "site" in n -> "🌐"
        "app" in n || "mobile" in n -> "📱"
        "api" in n || "back" in n -> "⚙️"
        "design" in n || "ui" in n -> "🎨"
        "ai" in n || "ml" in n || "llm" in n -> "🤖"
        "data" in n || "analytics" in n -> "📊"
        "doc" in n || "write" in n || "blog" in n -> "📝"
        "game" in n -> "🎮"
        else -> "📁"
    }
}

/** Matches .ctx-state — the shared loading/empty/error placeholder used across all three
 * list tabs when there's nothing to render yet. */
@Composable
fun PanelStateMessage(icon: String, text: String, isError: Boolean = false) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 28.dp, horizontal = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(icon, fontSize = 28.sp, modifier = Modifier.padding(bottom = 6.dp))
        Text(
            text,
            fontSize = 12.sp,
            color = if (isError) PanelColors.ErrorText else PanelColors.muted(0.3f),
        )
    }
}

@Composable
fun PanelSearchInput(value: String, placeholder: String, onValueChange: (String) -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(PanelColors.muted(0.06f))
            .border(1.dp, PanelColors.Border, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        if (value.isEmpty()) {
            Text(placeholder, fontSize = 12.sp, color = PanelColors.muted(0.25f))
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 12.sp, color = PanelColors.TextStrong),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
fun MemoryListItem(memory: BubbleMemory, onUse: (String) -> Unit) {
    var used by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(TYPE_ICON[memory.docType] ?: "📝", fontSize = 15.sp)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                memory.title.take(50),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PanelColors.TextStrong,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val preview = memory.content.replace("\n", " ").take(80)
            if (preview.isNotBlank()) {
                Text(
                    preview + (if (memory.content.length > 80) "…" else ""),
                    fontSize = 10.sp,
                    color = PanelColors.muted(0.38f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            val ts = formatRelativeTime(memory.createdAt)
            if (ts.isNotBlank()) {
                Text(ts, fontSize = 9.sp, color = PanelColors.muted(0.22f), modifier = Modifier.padding(top = 3.dp))
            }
        }
        InjectButton(
            label = if (used) "✓ Done" else "⚡ Use",
            done = used,
            onClick = { onUse(memory.content); used = true },
        )
    }
}

@Composable
fun ProjectListItem(project: BubbleProject, onUse: (BubbleProject) -> Unit, onOpen: (BubbleProject) -> Unit) {
    var used by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickableNoRipple { onOpen(project) }
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(PanelColors.Brand.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center,
        ) {
            Text(projectEmoji(project.name), fontSize = 16.sp)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                project.name.take(40),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PanelColors.TextStrong,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            project.description?.take(60)?.let {
                Text(
                    it,
                    fontSize = 10.sp,
                    color = PanelColors.muted(0.38f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 1.dp),
                )
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text("›", fontSize = 14.sp, color = PanelColors.muted(0.2f))
            Spacer(Modifier.height(4.dp))
            InjectButton(
                label = if (used) "✓" else "⚡ Use",
                done = used,
                onClick = { onUse(project); used = true },
            )
        }
    }
}

@Composable
private fun InjectButton(label: String, done: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(7.dp))
            .background(if (done) PanelColors.StatusOn else PanelColors.InjectBtnBg)
            .border(
                1.dp,
                if (done) PanelColors.StatusOn else PanelColors.InjectBtnBorder,
                RoundedCornerShape(7.dp),
            )
            .clickableNoRipple(onClick)
            .padding(horizontal = 9.dp, vertical = 4.dp),
    ) {
        Text(
            label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = if (done) androidx.compose.ui.graphics.Color.White else PanelColors.PlanText,
        )
    }
}
