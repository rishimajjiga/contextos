package com.usecontextos.app.bubble.panel

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Divider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.usecontextos.app.bubble.data.BubbleProject

/** Port of #ctx-tc-projects. */
@Composable
fun ProjectsTab(state: PanelState, onUse: (BubbleProject) -> Unit, onOpen: (BubbleProject) -> Unit) {
    when {
        state.projectsLoading -> PanelStateMessage("📁", "Loading…")
        state.projectsError != null -> PanelStateMessage("⚠️", state.projectsError!!, isError = true)
        state.projects.isNullOrEmpty() -> PanelStateMessage("📁", "No projects yet. Create one in the web app!")
        else -> {
            LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 168.dp)) {
                items(state.projects!!) { project ->
                    ProjectListItem(project = project, onUse = onUse, onOpen = onOpen)
                    Divider(color = PanelColors.Border, thickness = 1.dp)
                }
            }
        }
    }
}
