package com.usecontextos.app.bubble

import android.animation.ValueAnimator
import android.app.PendingIntent
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.res.Resources
import android.graphics.PixelFormat
import android.net.Uri
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.Toast
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.usecontextos.app.MainActivity
import com.usecontextos.app.R
import com.usecontextos.app.bubble.data.BubbleApiError
import com.usecontextos.app.bubble.data.BubbleProject
import com.usecontextos.app.bubble.data.ContextOSApi
import com.usecontextos.app.bubble.panel.BubblePanel
import com.usecontextos.app.bubble.panel.PanelState
import com.usecontextos.app.bubble.panel.PanelTab
import com.usecontextos.app.util.Constants
import com.usecontextos.app.util.CrashLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * Hosts the collapsed Floating Brain bubble AND, on tap, the expanded panel — two independent
 * system-wide overlay windows (TYPE_APPLICATION_OVERLAY), so the panel can appear/disappear
 * without ever recreating the bubble itself. Independent of any single app being in the
 * foreground, which is what makes both appear over Chrome, YouTube, Telegram, etc.
 *
 * Only ever started/stopped via WebAppBridge.enableBubble()/disableBubble() (user-initiated, per
 * the SYSTEM_ALERT_WINDOW permission it requires) or BootReceiver (restoring a state the user
 * already opted into) — never unconditionally at app launch, matching the same policy KeepAlive
 * Service documents for its own foreground service.
 */
class FloatingBubbleService : Service() {

    private lateinit var windowManager: WindowManager
    private lateinit var params: WindowManager.LayoutParams
    private lateinit var bubbleView: ComposeView
    private val lifecycleOwner = ComposeLifecycleOwner()

    private var pressed by mutableStateOf(false)
    private var snapAnimator: ValueAnimator? = null

    // ---- Panel ---------------------------------------------------------------------------------
    private var panelView: ComposeView? = null
    private var panelParams: WindowManager.LayoutParams? = null
    private var panelOpen by mutableStateOf(false)
    private val panelState = PanelState()
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var searchDebounceJob: Job? = null
    private var memSearchDebounceJob: Job? = null
    private lateinit var api: ContextOSApi

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        CrashLogger.d("Bubble", "Service onCreate")

        // RULE 1 — call startForeground() FIRST, unconditionally. Every caller starts us with
        // startForegroundService(), and Android kills the ENTIRE app (~5s later, as the
        // "Something went wrong with ContextOS — this app has a bug" dialog) if such a service
        // doesn't then call startForeground(). The old code's early return on missing overlay
        // permission skipped it — a guaranteed crash exactly when the user had just declined the
        // permission. So satisfy the contract before anything that can bail.
        // SPECIAL_USE is the correct FGS type for a floating overlay assistant — there is no
        // literal "overlay" type, and dataSync (what this used to declare) is a mismatch Play
        // reviewers flag on Android 14+. The manifest declares foregroundServiceType="specialUse"
        // plus the required PROPERTY_SPECIAL_USE_FGS_SUBTYPE justification. The constant is API 34;
        // ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE resolves to 1073741824 and is simply
        // ignored by the framework below 34, so it's safe down to this app's min API.
        try {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } catch (e: Exception) {
            // e.g. Android 12+ ForegroundServiceStartNotAllowedException (started from background
            // without an exemption). Nothing safe to draw — bail without crashing.
            CrashLogger.e("Bubble", "startForeground failed — stopping service", e)
            isRunning = false
            stopSelf()
            return
        }

        // RULE 2 — no overlay permission → nothing to draw. Now that the foreground contract is
        // satisfied, stop cleanly and clear the flag so recovery paths (worker/boot/package-
        // replaced) don't keep retrying. The user re-enables from the site toggle, which
        // re-requests the permission (see WebAppBridge.enableBubble).
        if (!Settings.canDrawOverlays(this)) {
            CrashLogger.e("Bubble", "Overlay permission missing on start — stopping safely, clearing enabled flag")
            prefs.edit().putBoolean(Constants.PREF_BUBBLE_ENABLED, false).apply()
            isRunning = false
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        // RULE 3 — any failure building the overlay/Compose host must stop the service, never
        // crash the process (a foreground service that throws takes the whole app down).
        try {
            windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
            api = ContextOSApi(this)
            setUpOverlayView()
            isRunning = true
        } catch (e: Exception) {
            CrashLogger.e("Bubble", "Overlay setup failed — stopping safely", e)
            isRunning = false
            prefs.edit().putBoolean(Constants.PREF_BUBBLE_ENABLED, false).apply()
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_DISABLE_BUBBLE -> {
                CrashLogger.d("Bubble", "Disable requested — stopping and cancelling recovery")
                prefs.edit().putBoolean(Constants.PREF_BUBBLE_ENABLED, false).apply()
                BubbleHealthWorker.cancel(this)
                isRunning = false
                stopSelf()
                return START_NOT_STICKY
            }
            // Sent by the health worker / restore button / package-replaced recovery. onCreate
            // already (re)built the bubble if the process had been killed; if the process was
            // alive but the overlay had somehow been detached, ensure it's showing again.
            // ::windowManager guard: if onCreate bailed before RULE 3 (permission revoked,
            // startForeground denied), this instance is already stopping — a queued action must
            // not touch the never-initialized overlay machinery (lateinit crash inside a
            // foreground service = whole app dies). Same RULE 3 rationale, applied here.
            ACTION_RESTORE -> if (::windowManager.isInitialized) {
                CrashLogger.d("Bubble", "Restore requested — ensuring bubble is attached")
                runCatching { ensureBubbleAttached() }
                    .onFailure { CrashLogger.e("Bubble", "restore failed — stopping safely", it) }
            }
            // FilePickerActivity finished extracting an uploaded file (bubble "📎" flow): prefill
            // the Save tab with the raw text for the user to review/edit, then open the panel.
            ACTION_SHOW_FILE_PREVIEW -> if (::windowManager.isInitialized) {
                runCatching {
                    ensureBubbleAttached()
                    com.usecontextos.app.capture.file.PendingFileText.consume()?.let { (title, text) ->
                        CrashLogger.d("Bubble", "Showing extracted file text for review (${text.length} chars)")
                        panelState.saveTitle = title
                        panelState.saveContent = text
                        panelState.saveTags = ""
                        panelState.saveStatus = null
                        panelState.saveLimitReached = false
                        panelState.savePrefilled = true // don't let clipboard-prefill overwrite this
                        panelState.activeTab = PanelTab.SAVE
                        if (!panelOpen) openPanel()
                    }
                }.onFailure { CrashLogger.e("Bubble", "file-preview handling failed", it) }
            }
        }
        // START_STICKY: if Android kills us under memory pressure, it recreates the service with a
        // null intent, which re-runs onCreate -> rebuilds the bubble. The health worker and
        // onTaskRemoved cover the cases START_STICKY alone doesn't (task swiped away, longer gaps).
        return START_STICKY
    }

    // The app being swiped out of Recents does NOT mean the user wants the bubble gone (Messenger
    // chat heads survive this). Schedule an immediate self-restart so the overlay comes right back.
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        CrashLogger.d("Bubble", "onTaskRemoved — task swiped away")
        if (prefs.getBoolean(Constants.PREF_BUBBLE_ENABLED, false) && Settings.canDrawOverlays(this)) {
            scheduleSelfRestart()
        }
    }

    /** Fires the service again ~1s later via AlarmManager — the reliable way to come back after
     * the task is removed, since the process may be torn down right after this returns. */
    private fun scheduleSelfRestart() {
        val restart = PendingIntent.getService(
            this,
            RESTART_REQUEST_CODE,
            Intent(this, FloatingBubbleService::class.java).setAction(ACTION_RESTORE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val alarm = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        runCatching {
            alarm.set(android.app.AlarmManager.RTC, System.currentTimeMillis() + 1000, restart)
        }
    }

    /** Duplicate guard (requirement 11): only add the overlay view if it isn't already added,
     * so recovery paths can call this freely without stacking multiple bubbles.
     *
     * isAttachedToWindow alone is NOT enough here: WindowManager.addView() assigns the view's
     * parent synchronously but dispatchAttachedToWindow only runs on the first traversal — so for
     * a few ms after onCreate adds the bubble, isAttachedToWindow is still false. An
     * ACTION_RESTORE delivered in that window (exactly what the health worker's
     * startForegroundService does on a cold restart) then re-ran setUpOverlayView(), whose
     * lifecycleOwner.onCreate() hit performRestore() on an already-RESUMED owner — a FATAL
     * IllegalStateException that took the whole app down. parent != null is the synchronous,
     * race-free "already added" signal. */
    private fun isBubbleAdded(): Boolean =
        ::bubbleView.isInitialized && (bubbleView.parent != null || bubbleView.isAttachedToWindow)

    private fun ensureBubbleAttached() {
        if (isBubbleAdded()) return
        setUpOverlayView()
    }

    private fun setUpOverlayView() {
        if (isBubbleAdded()) return // never double-add (addView would throw) or re-drive the owner
        lifecycleOwner.onCreate()
        lifecycleOwner.onStart()

        val bubblePx = dpToPx(BUBBLE_SIZE_DP)
        val savedY = prefs.getInt(PREF_BUBBLE_Y, defaultY())
        val snappedRight = prefs.getBoolean(PREF_BUBBLE_SNAPPED_RIGHT, true)

        params = WindowManager.LayoutParams(
            bubblePx,
            bubblePx,
            overlayWindowType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = if (snappedRight) screenWidthPx() - bubblePx else 0
            y = savedY
        }

        bubbleView = ComposeView(this).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setViewTreeLifecycleOwner(lifecycleOwner)
            setViewTreeViewModelStoreOwner(lifecycleOwner)
            setViewTreeSavedStateRegistryOwner(lifecycleOwner)
            setContent { BubbleRoot(pressed = pressed) }
            setOnTouchListener(dragListener())
        }

        try {
            windowManager.addView(bubbleView, params)
        } catch (e: Exception) {
            // A handful of OEM WebView-hosting/launcher combinations reject overlay windows even
            // with the permission granted (rare, but seen in the wild) — fail quietly rather than
            // crash the whole app process over a bubble that isn't essential to core functionality.
            CrashLogger.e("Bubble", "windowManager.addView failed", e)
            stopSelf()
        }
    }

    // ---- Drag + tap + edge-snap ---------------------------------------------------------------
    // Compose's own gesture APIs operate in the view's local coordinate space; updating a
    // WindowManager overlay's position needs screen coordinates and a live LayoutParams update
    // per move, which is far more directly expressed as a plain View touch listener than routed
    // through Compose — this is the standard approach for floating-bubble services generally.

    private fun dragListener(): View.OnTouchListener {
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var moved = false

        return View.OnTouchListener { view, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    snapAnimator?.cancel()
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    moved = false
                    pressed = true
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    if (!moved && (abs(dx) > DRAG_THRESHOLD_PX || abs(dy) > DRAG_THRESHOLD_PX)) {
                        moved = true
                    }
                    if (moved) {
                        params.x = initialX + dx.toInt()
                        params.y = initialY + dy.toInt()
                        runCatching { windowManager.updateViewLayout(bubbleView, params) }
                        if (panelOpen) repositionPanel()
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    pressed = false
                    if (moved) {
                        snapToNearestEdge()
                    } else {
                        // Not a real click target for most users (there's nothing to tab to on a
                        // system overlay), but TalkBack and other accessibility services expect
                        // any OnTouchListener-driven tap to still route through performClick().
                        view.performClick()
                        toggleOrOpenPanel()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun snapToNearestEdge() {
        val bubblePx = params.width
        val screenWidth = screenWidthPx()
        val snapToRight = (params.x + bubblePx / 2) >= screenWidth / 2
        val targetX = if (snapToRight) screenWidth - bubblePx else 0
        val clampedY = params.y.coerceIn(0, maxYPx(bubblePx))

        snapAnimator?.cancel()
        snapAnimator = ValueAnimator.ofInt(params.x, targetX).apply {
            duration = SNAP_ANIM_MS
            interpolator = DecelerateInterpolator()
            addUpdateListener { anim ->
                params.x = anim.animatedValue as Int
                params.y = clampedY
                runCatching { windowManager.updateViewLayout(bubbleView, params) }
                if (panelOpen) repositionPanel()
            }
            start()
        }

        prefs.edit()
            .putInt(PREF_BUBBLE_Y, clampedY)
            .putBoolean(PREF_BUBBLE_SNAPPED_RIGHT, snapToRight)
            .apply()
    }

    // ---- Panel open/close ------------------------------------------------------------------------
    // The bubble and the panel are separate windows, so a tap ON the bubble while the panel is
    // open is simultaneously: (a) a normal touch sequence on the bubble's own window, AND
    // (b) an "outside" touch as far as the panel's window is concerned (see
    // FLAG_WATCH_OUTSIDE_TOUCH below), which closes it. Without the debounce below, that close
    // would land first, then the bubble's own ACTION_UP handler would see panelOpen == false and
    // immediately reopen it — a close-then-instant-reopen flicker on every single bubble tap
    // while the panel is showing.
    private var lastOutsideCloseAtMs = 0L

    private fun toggleOrOpenPanel() {
        if (panelOpen) {
            closePanel()
        } else if (System.currentTimeMillis() - lastOutsideCloseAtMs > OUTSIDE_CLOSE_DEBOUNCE_MS) {
            openPanel()
        }
    }

    // A fresh ComposeView per open, disposed on close — deliberately NOT reused across
    // open/close cycles. Reusing one view meant every close/reopen detached and re-attached a
    // still-live composition (DisposeOnViewTreeLifecycleDestroyed keeps it alive while
    // detached, and our lifecycle owner never stops until the service dies); each re-attach
    // can bind that composition to a different window recomposer, and after enough cycles the
    // UI stops recomposing — taps still land but nothing visually reacts, which is exactly the
    // "buttons get stuck after using it a while" failure seen in testing. Rebuilding the view
    // is cheap (all data lives in panelState at the service level, so nothing is lost) and
    // removes that whole class of staleness.
    private fun openPanel() {
        createPanelView()
        panelOpen = true
        repositionPanel()
        try {
            windowManager.addView(panelView, panelParams)
        } catch (e: Exception) {
            CrashLogger.e("Bubble", "panel addView failed", e)
            panelOpen = false
            panelView = null
            return
        }
        refreshHealth()
        loadAccountInfo()
        onTabSelected(panelState.activeTab) // (re)load whatever tab is already active
    }

    private fun closePanel() {
        if (!panelOpen) return
        panelOpen = false
        panelView?.let { view ->
            runCatching { windowManager.removeView(view) }
            runCatching { view.disposeComposition() }
        }
        panelView = null
    }

    private fun closePanelFromOutsideTouch() {
        lastOutsideCloseAtMs = System.currentTimeMillis()
        closePanel()
    }

    private fun createPanelView() {
        val view = ComposeView(this).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setViewTreeLifecycleOwner(lifecycleOwner)
            setViewTreeViewModelStoreOwner(lifecycleOwner)
            setViewTreeSavedStateRegistryOwner(lifecycleOwner)
            setContent {
                BubblePanel(
                    state = panelState,
                    onClose = ::closePanel,
                    onTabSelected = ::onTabSelected,
                    onSaveClick = ::onSaveClick,
                    onUpgradeClick = { openApp(deepLinkPath = "plans") },
                    onUploadFile = ::launchFilePicker,
                    onMemoryQueryChange = ::onMemoryQueryChange,
                    onSearchQueryChange = ::onSearchQueryChange,
                    onUseMemory = ::copyToClipboard,
                    onUseProject = { p -> copyToClipboard(buildProjectContext(p)) },
                    onOpenProject = { p -> openApp(deepLinkPath = "projects/${p.id}") },
                    onOpenApp = { openApp(deepLinkPath = null) },
                    // Deliberately opens the HOMEPAGE, not /connect-extension. That page double-
                    // creates keys — the site's own ConnectExtensionPage mints a "Chrome
                    // Extension" key AND MainActivity's CONNECT_EXTRACT_SCRIPT mints an "Android
                    // App" key, so one tap left TWO keys on the account (the exact "2 keys on a
                    // 1-key free plan" the user hit). The homepage instead routes through
                    // MainActivity.maybeSyncBubbleAuth's clean delete-all-then-create mint, which
                    // guarantees exactly one "ContextOS Mobile" key shared by every native surface.
                    onConnectWithContextOS = { openApp(deepLinkPath = null) },
                    onConnectBackendUrlChange = { panelState.connectBackendUrlInput = it },
                    onConnectApiKeyChange = { panelState.connectApiKeyInput = it },
                    onSaveManualConnect = ::onSaveManualConnect,
                    onTestManualConnect = ::onTestManualConnect,
                    onDisconnectRequest = { panelState.showDisconnectConfirm = true },
                    onDisconnectConfirm = ::onDisconnectConfirm,
                    onDisconnectCancel = { panelState.showDisconnectConfirm = false },
                )
            }
            // FLAG_WATCH_OUTSIDE_TOUCH (set on the window below) delivers outside taps here as
            // ACTION_OUTSIDE rather than to the panel's own content — this is the only listener
            // that ever sees them.
            setOnTouchListener { view, event ->
                if (event.action == MotionEvent.ACTION_OUTSIDE) {
                    view.performClick() // see the bubble's own drag listener for why
                    closePanelFromOutsideTouch()
                    true
                } else {
                    false
                }
            }
        }
        panelView = view
    }

    /** Smart direction, ported from openPanel()'s isTopHalf check: if the bubble is in the top
     * half of the screen the panel opens downward from it, otherwise upward — computed via
     * gravity BOTTOM|START with a from-screen-bottom y offset so the panel grows upward from
     * its anchor without needing to know its own height in advance (mirrors the reference's
     * `bottom: Xpx` CSS anchoring exactly, just expressed as WindowManager gravity instead). */
    private fun repositionPanel() {
        val panelWidthPx = dpToPx(PANEL_WIDTH_DP)
        val gapPx = dpToPx(8)
        val bubblePx = params.width
        val isTopHalf = params.y < screenHeightPx() / 2

        val x = (params.x + bubblePx - panelWidthPx).coerceIn(0, (screenWidthPx() - panelWidthPx).coerceAtLeast(0))

        val newParams = WindowManager.LayoutParams(
            panelWidthPx,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayWindowType(),
            // Deliberately NOT FLAG_NOT_FOCUSABLE, unlike the bubble's own window — this one
            // hosts real text fields (Save tab, Connect tab), and a non-focusable window can
            // never receive an IME connection at all: taps register (touch doesn't need window
            // focus) but typing and paste silently do nothing, because there's no focused
            // window for the keyboard to attach to. This is the single most load-bearing flag
            // on this whole window.
            //
            // FLAG_NOT_TOUCH_MODAL is equally load-bearing in the other direction: without it,
            // a focusable window claims ALL touches everywhere, not just its own bounds — every
            // tap outside the panel (the underlying app, the bubble itself) gets swallowed
            // instead of passed through, which is exactly the "everything's stuck" symptom.
            // FLAG_WATCH_OUTSIDE_TOUCH then delivers those passed-through outside taps here as
            // a dedicated ACTION_OUTSIDE event (see the touch listener above) so the panel can
            // close itself on them, the way any dismissable popup is expected to behave.
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT,
        ).apply {
            this.x = x
            if (isTopHalf) {
                gravity = Gravity.TOP or Gravity.START
                y = params.y + bubblePx + gapPx
            } else {
                gravity = Gravity.BOTTOM or Gravity.START
                y = screenHeightPx() - params.y + gapPx
            }
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        }
        panelParams = newParams
        panelView?.let { view ->
            if (view.isAttachedToWindow) runCatching { windowManager.updateViewLayout(view, newParams) }
        }
    }

    // ---- Tab data loading — mirrors switchTab()/initSaveTab()/loadPanelMemories()/etc. --------

    private fun onTabSelected(tab: PanelTab) {
        panelState.activeTab = tab
        when (tab) {
            PanelTab.SAVE -> prefillSaveTabIfNeeded()
            PanelTab.MEMORIES -> loadMemories()
            PanelTab.PROJECTS -> loadProjects()
            PanelTab.SEARCH -> Unit // waits for input, same as the reference
            PanelTab.CONNECT -> prefillConnectTabIfNeeded()
        }
    }

    private fun prefillConnectTabIfNeeded() {
        panelState.isConnected = com.usecontextos.app.bubble.data.BubbleCredentialStore.isSignedIn(this)
        if (panelState.connectBackendUrlInput.isBlank()) {
            panelState.connectBackendUrlInput = com.usecontextos.app.bubble.data.BubbleCredentialStore.getApiUrl(this)
        }
        // Never prefill the API key field itself — a masked field showing a stored secret back
        // to the user isn't meaningfully more useful than blank, and re-populating it risks the
        // user assuming a blank Save clears it when it would actually just resave the same value.
    }

    private fun onSaveManualConnect() {
        val url = panelState.connectBackendUrlInput.trim().ifBlank { com.usecontextos.app.bubble.data.BubbleCredentialStore.DEFAULT_API_URL }
        val key = panelState.connectApiKeyInput.trim()
        if (key.isBlank()) {
            panelState.connectStatus = "Enter an API key first."
            panelState.connectStatusIsError = true
            return
        }
        com.usecontextos.app.bubble.data.BubbleCredentialStore.saveApiKey(this, key, url)
        panelState.isConnected = true
        panelState.connectApiKeyInput = ""
        panelState.connectStatus = "Saved."
        panelState.connectStatusIsError = false
        // A newly-saved key invalidates anything fetched under the old (or no) credentials.
        panelState.memories = null
        panelState.projects = null
        panelState.accountLoaded = false
    }

    private fun onTestManualConnect() {
        val url = panelState.connectBackendUrlInput.trim().ifBlank { com.usecontextos.app.bubble.data.BubbleCredentialStore.DEFAULT_API_URL }
        panelState.connectTesting = true
        panelState.connectStatus = null
        serviceScope.launch {
            val ok = runCatching { api.healthCheck(url) }.getOrDefault(false)
            panelState.connectStatus = if (ok) "Backend reachable." else "Could not reach that backend."
            panelState.connectStatusIsError = !ok
            panelState.connectTesting = false
        }
    }

    private fun onDisconnectConfirm() {
        panelState.showDisconnectConfirm = false
        com.usecontextos.app.bubble.data.BubbleCredentialStore.clear(this)
        panelState.isConnected = false
        panelState.email = null
        panelState.planLabel = null
        panelState.hasTeam = false
        panelState.accountLoaded = false
        panelState.memories = null
        panelState.projects = null
        panelState.connectStatus = "Disconnected."
        panelState.connectStatusIsError = false
    }

    private fun prefillSaveTabIfNeeded() {
        if (panelState.savePrefilled) return
        panelState.savePrefilled = true
        val clip = (getSystemService(CLIPBOARD_SERVICE) as? ClipboardManager)
            ?.primaryClip
            ?.takeIf { it.itemCount > 0 }
            ?.getItemAt(0)
            ?.coerceToText(this)
            ?.toString()
        if (!clip.isNullOrBlank() && panelState.saveContent.isBlank()) {
            panelState.saveContent = clip.take(MAX_SAVE_CHARS)
        }
    }

    private fun onSaveClick() {
        val title = panelState.saveTitle.trim().ifBlank { "Untitled" }
        val content = panelState.saveContent.trim()
        if (content.isBlank()) {
            panelState.saveStatus = "Content required."
            panelState.saveStatusIsError = true
            return
        }
        val tags = panelState.saveTags.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        // "private" is the website's actual default value (CreateMemoryPayload.visibility) —
        // team sharing is opt-in via the checkbox, and only ever available/relevant when hasTeam.
        val visibility = if (panelState.hasTeam && panelState.saveShareTeam) "team" else "private"
        panelState.saving = true
        panelState.saveStatus = null
        panelState.saveLimitReached = false
        serviceScope.launch {
            try {
                api.saveMemory(title = title, content = content, tags = tags, visibility = visibility)
                panelState.memories = null // bust cache, same as _panelMemCache = null
                panelState.saveTitle = ""
                panelState.saveContent = ""
                panelState.saveTags = ""
                panelState.saveStatus = "Memory saved to your brain."
                panelState.saveStatusIsError = false
            } catch (e: Exception) {
                panelState.saveStatus = friendlyError(e)
                panelState.saveStatusIsError = true
                panelState.saveLimitReached = e is BubbleApiError.LimitReached
            } finally {
                panelState.saving = false
            }
        }
    }

    private fun loadMemories() {
        if (panelState.memories != null) return // cached, same as _panelMemCache
        panelState.memoriesLoading = true
        panelState.memoriesError = null
        serviceScope.launch {
            try {
                panelState.memories = api.listMemories()
            } catch (e: Exception) {
                panelState.memoriesError = friendlyError(e)
            } finally {
                panelState.memoriesLoading = false
            }
        }
    }

    private fun onMemoryQueryChange(query: String) {
        panelState.memoryQuery = query
        memSearchDebounceJob?.cancel()
        if (query.isBlank()) {
            loadMemories()
            return
        }
        memSearchDebounceJob = serviceScope.launch {
            delay(SEARCH_DEBOUNCE_MS)
            try {
                panelState.memories = api.searchMemories(query)
            } catch (e: Exception) {
                panelState.memoriesError = friendlyError(e)
            }
        }
    }

    private fun loadProjects() {
        if (panelState.projects != null) return
        panelState.projectsLoading = true
        panelState.projectsError = null
        serviceScope.launch {
            try {
                panelState.projects = api.listProjects()
            } catch (e: Exception) {
                panelState.projectsError = friendlyError(e)
            } finally {
                panelState.projectsLoading = false
            }
        }
    }

    private fun onSearchQueryChange(query: String) {
        panelState.searchQuery = query
        searchDebounceJob?.cancel()
        if (query.isBlank()) {
            panelState.searchRan = false
            return
        }
        panelState.searchLoading = true
        searchDebounceJob = serviceScope.launch {
            delay(SEARCH_DEBOUNCE_MS)
            try {
                val memories = api.searchMemories(query, limit = 8)
                val projects = (panelState.projects ?: runCatching { api.listProjects() }.getOrNull() ?: emptyList())
                    .filter { it.name.contains(query, ignoreCase = true) || it.description?.contains(query, ignoreCase = true) == true }
                panelState.searchMemoryResults = memories
                panelState.searchProjectResults = projects
                panelState.searchError = null
            } catch (e: Exception) {
                panelState.searchError = friendlyError(e)
            } finally {
                panelState.searchLoading = false
                panelState.searchRan = true
            }
        }
    }

    private fun loadAccountInfo() {
        if (panelState.accountLoaded) return
        serviceScope.launch {
            try {
                val user = api.getUserInfo()
                if (user.email == null) return@launch
                panelState.email = user.email
                panelState.accountLoaded = true
                runCatching { api.getPlan() }.getOrNull()?.let {
                    val label = if (it.displayName.contains("plan", ignoreCase = true)) it.displayName else "${it.displayName} Plan"
                    panelState.planLabel = label
                }
                runCatching { api.getTeamInfo() }.getOrNull()?.let {
                    panelState.hasTeam = it.hasTeam
                    // Enable/disable the "Save to Team" selection-menu entry to match the plan —
                    // the menu can't be filtered by plan any other way (see the alias in the
                    // manifest and ProcessTextActivity).
                    setTeamSelectionEntryEnabled(it.hasTeam)
                }
            } catch (e: Exception) {
                // Stays not-loaded — retried next panel open, same as _panelAcctLoaded = false on error.
            }
        }
    }

    private fun setTeamSelectionEntryEnabled(enabled: Boolean) {
        val component = android.content.ComponentName(this, "com.usecontextos.app.bubble.ProcessTextTeam")
        val target = if (enabled) android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        else android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        runCatching {
            packageManager.setComponentEnabledSetting(component, target, android.content.pm.PackageManager.DONT_KILL_APP)
        }
    }

    private fun refreshHealth() {
        serviceScope.launch {
            panelState.isOnline = runCatching { api.health() }.getOrDefault(false)
        }
    }

    private fun friendlyError(e: Exception): String = when (e) {
        is BubbleApiError.NotConfigured -> "Sign in to ContextOS first."
        is BubbleApiError.Auth -> {
            // Same self-heal as the selection-save path: the key was rejected, so clear it and
            // let the app re-mint from the live Clerk session on its next resume. Not a sign-out.
            com.usecontextos.app.bubble.data.BubbleCredentialStore.clear(this)
            "ContextOS needs to reconnect — open the app once, then try again."
        }
        is BubbleApiError.LimitReached -> "Plan limit reached — upgrade for more."
        is BubbleApiError.Network -> "Can't reach ContextOS. Check your connection."
        else -> "Something went wrong. Try again."
    }

    // "Use" copies to the clipboard rather than injecting directly into the focused field:
    // writing into another app's input requires an AccessibilityService, which was deliberately
    // removed for Play Store compliance (see AndroidManifest note). Closing the panel first means
    // the user is looking straight at their chat/input, one long-press-and-paste away.
    private fun copyToClipboard(text: String) {
        if (text.isBlank()) return
        (getSystemService(CLIPBOARD_SERVICE) as? ClipboardManager)
            ?.setPrimaryClip(ClipData.newPlainText("ContextOS", text))
        closePanel()
        Toast.makeText(this, "Copied — long-press your text field and tap Paste", Toast.LENGTH_LONG).show()
    }

    private fun buildProjectContext(p: BubbleProject): String {
        val parts = mutableListOf("Project: ${p.name}")
        p.description?.let { parts.add(it) }
        return parts.joinToString("\n")
    }

    // A plain context.startActivity() called from a Service (not a real foreground Activity) is
    // subject to Android's background-activity-launch restrictions and can be silently dropped
    // on some Android versions/OEMs — no crash, no log the app itself can see, the tap just
    // does nothing. A PendingIntent is the standard, reliable way to launch an Activity from
    // exactly this kind of context (it's what the bubble's own notification already uses
    // successfully for its "tap to open" action) — it carries launch permission forward in a
    // way a bare Context.startActivity() call from here doesn't reliably get.
    private fun openApp(deepLinkPath: String?) {
        closePanel()
        val uri = if (deepLinkPath != null) Uri.parse("contextos://$deepLinkPath") else null
        val intent = if (uri != null) {
            Intent(Intent.ACTION_VIEW, uri, this, MainActivity::class.java)
        } else {
            Intent(this, MainActivity::class.java)
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        try {
            PendingIntent.getActivity(
                this,
                deepLinkPath.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ).send()
        } catch (e: PendingIntent.CanceledException) {
            CrashLogger.e("Bubble", "openApp PendingIntent.send() failed for $deepLinkPath", e)
        }
    }

    // Panel "📎" button: close the panel, open the system document picker. FilePickerActivity
    // extracts the file's raw text and saves it via the existing saveMemory (FileCaptureHandler),
    // exactly like the launcher shortcut / share-to-ContextOS paths — no new save logic. Launched
    // via PendingIntent (same reason as openApp: reliable Activity start from this service).
    private fun launchFilePicker() {
        closePanel()
        val intent = Intent(this, com.usecontextos.app.capture.file.FilePickerActivity::class.java)
            // PREVIEW mode: the picker extracts the text and hands it back here (ACTION_SHOW_FILE_
            // PREVIEW) to prefill the Save tab for review/edit, rather than saving immediately.
            .putExtra(com.usecontextos.app.capture.file.FilePickerActivity.EXTRA_PREVIEW, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            PendingIntent.getActivity(
                this,
                FILE_PICKER_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ).send()
        } catch (e: PendingIntent.CanceledException) {
            CrashLogger.e("Bubble", "launchFilePicker PendingIntent.send() failed", e)
        }
    }

    // ---- Lifecycle -----------------------------------------------------------------------------

    override fun onDestroy() {
        CrashLogger.d("Bubble", "Service onDestroy")
        isRunning = false
        snapAnimator?.cancel()
        serviceScope.cancel()
        closePanel()
        if (::bubbleView.isInitialized) {
            runCatching { windowManager.removeView(bubbleView) }
            CrashLogger.d("Bubble", "Bubble view removed")
        }
        lifecycleOwner.onDestroy()
        // If we're being destroyed while the user still wants the bubble (i.e. NOT via the Disable
        // action, which clears the flag first), this was an Android-initiated kill — schedule a
        // comeback. START_STICKY usually handles it, but this covers kills where it doesn't.
        if (prefs.getBoolean(Constants.PREF_BUBBLE_ENABLED, false) && Settings.canDrawOverlays(this)) {
            CrashLogger.d("Bubble", "Destroyed while still enabled — scheduling restart")
            scheduleSelfRestart()
        }
        super.onDestroy()
    }

    // ---- Sizing / positioning helpers -----------------------------------------------------------

    private val prefs get() = getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)

    private fun dpToPx(dp: Int): Int =
        (dp * Resources.getSystem().displayMetrics.density).toInt()

    private fun screenWidthPx(): Int = Resources.getSystem().displayMetrics.widthPixels
    private fun screenHeightPx(): Int = Resources.getSystem().displayMetrics.heightPixels
    private fun maxYPx(bubblePx: Int): Int = (screenHeightPx() - bubblePx).coerceAtLeast(0)
    private fun defaultY(): Int = screenHeightPx() / 3

    // minSdk is already 26 (Android 8.0) app-wide, the same level that introduced
    // TYPE_APPLICATION_OVERLAY — no older TYPE_PHONE fallback is needed.
    private fun overlayWindowType(): Int = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY

    // Doubles as the "revisitable toggle" the bubble spec calls for: this app has no native
    // settings screen (it's WebView-first — settings live on the website), so rather than build
    // a whole new native screen for a single switch, the always-visible persistent notification
    // — required anyway per foreground-service policy — carries the same "Stop" action pattern
    // KeepAliveService already establishes. Genuinely revisitable (visible the entire time the
    // bubble is on), just via the notification shade rather than an in-app settings page.
    private fun buildNotification(): android.app.Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val disableIntent = PendingIntent.getService(
            this,
            0,
            Intent(this, FloatingBubbleService::class.java).setAction(ACTION_DISABLE_BUBBLE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, getString(R.string.bubble_channel_id))
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(getColor(R.color.brand_green))
            .setContentTitle(getString(R.string.bubble_notification_title))
            .setContentText(getString(R.string.bubble_notification_text))
            .setOngoing(true)
            .setContentIntent(openIntent)
            .addAction(0, getString(R.string.bubble_action_disable), disableIntent)
            .build()
    }

    companion object {
        private const val NOTIFICATION_ID = 43
        // This is the overlay WINDOW size, not the visible card. The card stays 44dp (unchanged —
        // matching content.js's #ctx-fab-btn "small, unobtrusive" intent); the window is 12dp
        // larger so the green visibility glow (see BubbleContent) has transparent room to render
        // on all sides instead of being clipped hard at the window edge. BubbleContent centres the
        // 44dp card inside this window, so the touch target and appearance of the card are the
        // same size as before — only the halo gained breathing room.
        private const val BUBBLE_SIZE_DP = 56
        private const val PANEL_WIDTH_DP = 240
        private const val DRAG_THRESHOLD_PX = 12f
        private const val SNAP_ANIM_MS = 250L
        private const val SEARCH_DEBOUNCE_MS = 350L
        private const val MAX_SAVE_CHARS = 8000
        // How long after an outside-tap-triggered close to ignore the bubble's own tap-to-open —
        // see the comment on toggleOrOpenPanel().
        private const val OUTSIDE_CLOSE_DEBOUNCE_MS = 300L
        const val PREF_BUBBLE_Y = "bubble_last_y"
        const val PREF_BUBBLE_SNAPPED_RIGHT = "bubble_snapped_right"
        private const val ACTION_DISABLE_BUBBLE = "com.usecontextos.app.action.DISABLE_BUBBLE"
        const val ACTION_RESTORE = "com.usecontextos.app.action.RESTORE_BUBBLE"
        const val ACTION_SHOW_FILE_PREVIEW = "com.usecontextos.app.action.SHOW_FILE_PREVIEW"
        private const val RESTART_REQUEST_CODE = 71
        private const val FILE_PICKER_REQUEST_CODE = 72

        // Process-wide "is the service alive right now" flag. Set true once onCreate finishes
        // drawing, false on destroy/permission-loss. Read by the health worker and restore paths
        // to avoid starting a second instance (they still call startForegroundService, which is a
        // no-op re-delivery if we're already up — but this lets callers log/decide correctly).
        @Volatile
        var isRunning: Boolean = false
            private set

        /** Single, idempotent way for every recovery path (worker, boot, package-replaced,
         * restore button) to (re)start the bubble — only when the user wants it and it can draw. */
        fun startIfEnabled(context: Context): Boolean {
            val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
            val wanted = prefs.getBoolean(Constants.PREF_BUBBLE_ENABLED, false)
            if (!wanted || !Settings.canDrawOverlays(context)) return false
            runCatching {
                androidx.core.content.ContextCompat.startForegroundService(
                    context,
                    Intent(context, FloatingBubbleService::class.java).setAction(ACTION_RESTORE),
                )
            }.onFailure { CrashLogger.e("Bubble", "startIfEnabled failed", it) }
            return true
        }
    }
}
