package com.usecontextos.app.bubble.panel

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Divider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.usecontextos.app.bubble.data.BubbleProject

/** Port of #ctx-tc-search / runPanelSearch: projects section, then memories section. */
@Composable
fun SearchTab(
    state: PanelState,
    onQueryChange: (String) -> Unit,
    onUseMemory: (String) -> Unit,
    onUseProject: (BubbleProject) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().heightIn(max = 168.dp)) {
        PanelSearchInput(value = state.searchQuery, placeholder = "Search memories…", onValueChange = onQueryChange)

        when {
            state.searchQuery.isBlank() -> PanelStateMessage("🔍", "Type to search…")
            state.searchLoading -> PanelStateMessage("⟳", "Searching…")
            state.searchError != null -> PanelStateMessage("⚠️", state.searchError!!, isError = true)
            state.searchRan && state.searchMemoryResults.isEmpty() && state.searchProjectResults.isEmpty() ->
                PanelStateMessage("🔍", "No results for \"${state.searchQuery}\"")
            else -> {
                LazyColumn(modifier = Modifier.fillMaxWidth()) {
                    if (state.searchProjectResults.isNotEmpty()) {
                        item { SectionLabel("Projects") }
                        items(state.searchProjectResults) { project ->
                            ProjectListItem(project = project, onUse = onUseProject, onOpen = {})
                            Divider(color = PanelColors.Border, thickness = 1.dp)
                        }
                    }
                    if (state.searchMemoryResults.isNotEmpty()) {
                        item { SectionLabel("Memories") }
                        items(state.searchMemoryResults) { memory ->
                            MemoryListItem(memory = memory, onUse = onUseMemory)
                            Divider(color = PanelColors.Border, thickness = 1.dp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        fontSize = 9.sp,
        fontWeight = FontWeight.ExtraBold,
        color = PanelColors.muted(0.3f),
        modifier = Modifier.padding(start = 14.dp, end = 14.dp, top = 7.dp, bottom = 4.dp),
    )
}
