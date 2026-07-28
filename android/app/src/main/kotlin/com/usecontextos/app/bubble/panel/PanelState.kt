package com.usecontextos.app.bubble.panel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.usecontextos.app.bubble.data.BubbleMemory
import com.usecontextos.app.bubble.data.BubbleProject

enum class PanelTab(val label: String?, val emoji: String) {
    SAVE("Save", "💾"),
    MEMORIES("Memory", "🧠"),
    PROJECTS("Projects", "📁"),
    SEARCH("Search", "🔍"),
    CONNECT(null, "🔌"), // icon-only, no label — matches the reference's ctx-tc-connect tab
}

/** One of these per FloatingBubbleService instance — lives across open/close cycles so
 * switching tabs back and forth doesn't refetch, mirroring content.js's module-level
 * _panelMemCache / _panelProjCache / _panelAcctLoaded caches. */
class PanelState {
    var activeTab by mutableStateOf(PanelTab.SAVE)
    var isOnline by mutableStateOf(false)

    // Account row
    var accountLoaded by mutableStateOf(false)
    var email by mutableStateOf<String?>(null)
    var planLabel by mutableStateOf<String?>(null)
    var hasTeam by mutableStateOf(false)

    // Save tab — fields match the website's SaveMemoryPage.tsx exactly
    var saveTitle by mutableStateOf("")
    var saveContent by mutableStateOf("")
    var saveTags by mutableStateOf("") // comma-separated, same as the website's own tags input
    var saveShareTeam by mutableStateOf(false) // only shown/used when hasTeam is true
    var saveStatus by mutableStateOf<String?>(null)
    var saveStatusIsError by mutableStateOf(false)
    var saving by mutableStateOf(false)
    var savePrefilled by mutableStateOf(false)
    // Set when a save fails with 402 LIMIT_REACHED — shows the Upgrade → /plans button,
    // mirroring the website's own at-limit upgrade CTA on SaveMemoryPage.
    var saveLimitReached by mutableStateOf(false)

    // Memory tab
    var memoriesLoading by mutableStateOf(false)
    var memoriesError by mutableStateOf<String?>(null)
    var memories by mutableStateOf<List<BubbleMemory>?>(null)
    var memoryQuery by mutableStateOf("")

    // Projects tab
    var projectsLoading by mutableStateOf(false)
    var projectsError by mutableStateOf<String?>(null)
    var projects by mutableStateOf<List<BubbleProject>?>(null)

    // Search tab
    var searchQuery by mutableStateOf("")
    var searchLoading by mutableStateOf(false)
    var searchError by mutableStateOf<String?>(null)
    var searchMemoryResults by mutableStateOf<List<BubbleMemory>>(emptyList())
    var searchProjectResults by mutableStateOf<List<BubbleProject>>(emptyList())
    var searchRan by mutableStateOf(false)

    // Connect tab — manual fallback alongside the primary "Connect with ContextOS" button
    var connectBackendUrlInput by mutableStateOf("")
    var connectApiKeyInput by mutableStateOf("")
    var connectTesting by mutableStateOf(false)
    var connectStatus by mutableStateOf<String?>(null)
    var connectStatusIsError by mutableStateOf(false)
    var showDisconnectConfirm by mutableStateOf(false)
    var isConnected by mutableStateOf(false)
}
