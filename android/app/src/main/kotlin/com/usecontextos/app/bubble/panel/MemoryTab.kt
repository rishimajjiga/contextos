package com.usecontextos.app.bubble.panel

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Divider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Port of #ctx-tc-memories: search box + list, "View all memories →" footer link. */
@Composable
fun MemoryTab(state: PanelState, onQueryChange: (String) -> Unit, onUse: (String) -> Unit, onViewAll: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().heightIn(max = 168.dp)) {
        PanelSearchInput(value = state.memoryQuery, placeholder = "Search memories…", onValueChange = onQueryChange)

        when {
            state.memoriesLoading -> PanelStateMessage("🧠", "Loading…")
            state.memoriesError != null -> PanelStateMessage("⚠️", state.memoriesError!!, isError = true)
            state.memories.isNullOrEmpty() -> PanelStateMessage("🧠", "No memories yet. Save your first one!")
            else -> {
                LazyColumn(modifier = Modifier.fillMaxWidth()) {
                    items(state.memories!!) { memory ->
                        MemoryListItem(memory = memory, onUse = onUse)
                        Divider(color = PanelColors.Border, thickness = 1.dp)
                    }
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickableNoRipple(onViewAll)
                                .padding(vertical = 10.dp, horizontal = 14.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "VIEW ALL MEMORIES →",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = PanelColors.muted(0.3f),
                            )
                        }
                    }
                }
            }
        }
    }
}
