# ContextOS Chrome Extension Audit

**Date:** 2026-06-16  
**Manifest:** MV3 (`extension/manifest.json` v1.0.0)  
**Content Scripts:** `content.js` (AI platforms), `connect.js` (OAuth handoff)

---

## Extension Architecture

```
manifest.json
├── background.js          Service worker — API proxy, popup window, cache
├── content.js + styles.css  Injected on 25+ AI platform URLs
├── connect.js               Injected on /connect-extension only
├── popup.html + popup.js    Floating extension UI (360×580 window)
└── icons/                   16, 48, 128 PNG (generated)
```

### Message Flow

```
Content Script / Popup
    │ chrome.runtime.sendMessage({ type, ... })
    ▼
background.js → handleMessage()
    │ fetch() + X-Api-Key
    ▼
ContextOS API (/api/v1/documents, /search)
```

### Message Types

| Type | Method | Endpoint |
|------|--------|----------|
| `LIST_MEMORY` | GET | `/api/v1/documents?page=1&per_page=20` |
| `SEARCH_MEMORY` | POST | `/api/v1/search` |
| `SAVE_MEMORY` | POST | `/api/v1/documents` |
| `GET_CONTEXT` | GET | `/api/v1/documents?page=1&per_page=50` (merged) |

---

## Problems Found (Extension-Specific)

### 1. Always-On Keep-Alive (CRITICAL)

**Before:** Every content script called `keepWorkerAlive()` at init, opening a `chrome.runtime.connect({ name: "keepAlive" })` port, disconnecting and reconnecting every 20 seconds — on every AI tab, even with auto-suggestions OFF.

**Root cause:** Keep-alive was treated as mandatory infrastructure rather than opt-in for active features.

**Fix:** `startKeepWorkerAlive()` / `stopKeepWorkerAlive()` — only runs when `_autoSuggestOn === true`. Port cycle extended to 45s. Background registers `onConnect` handler. Alarm reduced from 0.4min to 1min.

**Default user experience:** Auto-suggestions OFF = zero port activity, zero background CPU from keep-alive.

---

### 2. Input Watcher Interval Leak (CRITICAL)

**Before:** `attachInputWatcher()` created:
- `setInterval(tryAttach, 3000)` — never stopped if input never found
- `setInterval(_stopCheck, 2000)` — second timer
- `setInterval(..., 15000)` — permanent SPA nav check

Calling `watchInputForSuggestions()` multiple times (init + toggle ON + storage sync) stacked duplicate intervals.

**Fix:** Singleton `_inputWatcher` with `stopInputWatcher()` cleanup. Aggressive 3s polling limited to 10 attempts (~30s). Single 20s nav check interval. `stopInputWatcher()` called when suggestions toggled OFF.

---

### 3. MutationObserver on Contenteditable (HIGH — when ON)

**Before:** Observer with `{ subtree: true }` fired during AI streaming if input stayed focused.

**Existing mitigation preserved:** Observer disconnects on `blur`, reconnects on `focus`.

**Additional fix:** Observer callback checks `_autoSuggestOn` before processing. Watcher fully torn down when suggestions OFF.

---

### 4. Broad Site Injection (HIGH)

**Before:** `github.com/*` and `x.com/*` in manifest matches injected content script on all pages (repo browsing, timelines, etc.).

**Fix:** `getPlatform()` returns `null` unless:
- **GitHub:** URL or DOM indicates Copilot chat (`#copilot-chat-textarea`, etc.)
- **X.com:** URL or DOM indicates Grok

No script UI injected on non-AI surfaces. FAB and watchers never initialize.

---

### 5. DOM Scanning Cost (MEDIUM)

**Before:** `findInputWithShadow()` always ran broad `querySelectorAll("[contenteditable]")` and `querySelectorAll("textarea")` on cache miss.

**Fix:**
- Cache TTL: 1s → 5s
- Platform-specific selectors + Gemini shadow DOM in hot path
- Broad fallbacks moved to `findInputFallback()`, only called during attach attempts

---

### 6. FAB Performance (MEDIUM)

**Before:**
- `styles.css` set `min-width: 140px` on `#ctx-fab` conflicting with 44px circular button
- Drag updated `style.right/bottom` on every mousemove
- Storage write on every mouseup (acceptable) but also per-frame style updates caused jitter

**Fix:**
- Inline styles override with `min-width: 0 !important`
- Legacy CSS scoped to `.ctx-legacy-fab`
- Drag position updates batched via `requestAnimationFrame`
- Storage write debounced 400ms after drag end
- Menu close listener only active while menu open

---

### 7. API Layer (HIGH)

**Before:**
- Wrong query param `page_size` (backend ignored it)
- No caching — each keystroke debounce triggered fresh network request
- Concurrent identical searches not deduplicated

**Fix (`background.js`):**
- Correct `per_page` param
- Cache: LIST 30s, SEARCH 15s, CONTEXT 60s
- In-flight deduplication via `_inflight` Map
- Cache invalidated on SAVE_MEMORY

---

### 8. Stale Search Results (MEDIUM)

**Before:** Fast typing could show suggestions from an older query.

**Fix:** `_searchAbortId` incremented on each new search and on watcher stop; results discarded if ID mismatches.

---

### 9. Missing Icons (HIGH — install blocker)

**Before:** `manifest.json` referenced `icons/icon16.png` etc. but directory was empty.

**Fix:** Ran `python make-icons.py` — icons generated.

---

## Supported Platforms

| Platform | Host | Input Detection |
|----------|------|-----------------|
| Claude | claude.ai | `[data-testid="chat-input"]`, ProseMirror |
| ChatGPT | chatgpt.com, chat.openai.com | `#prompt-textarea` |
| Gemini | gemini.google.com | `.ql-editor`, rich-textarea shadow |
| Copilot | copilot.microsoft.com | textarea, contenteditable |
| Perplexity | perplexity.ai | textarea |
| Mistral | chat.mistral.ai | textarea |
| Grok | grok.com, x.com (Grok only) | textarea |
| GitHub Copilot | github.com (Copilot only) | `#copilot-chat-textarea` |
| VS Code Web | vscode.dev, github.dev | `.chat-input-part textarea` |
| DeepSeek | chat.deepseek.com | textarea |
| + 8 more | See `PLATFORMS` in content.js | |

**Not in manifest:** `cursor.com` — Cursor IDE web not currently supported.

---

## Auto-Suggestions Behavior (Default OFF)

| Setting | Background Activity |
|---------|---------------------|
| OFF (default) | FAB only. No keep-alive. No input watcher. No API calls. |
| ON | Keep-alive port, input listeners, debounced search (1800ms), MutationObserver on focused contenteditable |

Users enable via FAB menu: **⚡ Auto-suggestions: ON/OFF**

---

## Permissions Justification

| Permission | Use |
|------------|-----|
| `storage` | API key, settings, FAB position |
| `activeTab` | Page capture in popup save tab |
| `scripting` | Reserved for dynamic injection if needed |
| `alarms` | MV3 service worker keep-alive backup |
| `tabs` | Connect flow tab management |
| `windows` | Floating popup window |

---

## Remaining Extension Warnings

1. **GitHub late Copilot load** — If Copilot panel opens after 30s attach window on a page that had no Copilot at init, user may need to toggle suggestions or refresh. Rare edge case.

2. **x.com SPA navigation** — Grok route changes may require 20s nav check cycle to re-attach.

3. **Large memory injection** — `injectIntoInput()` prepends full memory content; very large memories can slow input. `MAX_CHARS = 6000` caps saves but not injection from sidebar. Consider truncation in future (not changed to preserve behavior).

4. **Dual style injection** — `styles.css` (manifest) + `injectStyles()` (JS). Legacy picker/suggestion chip styles in CSS unused by current toast UI but preserved for compatibility.

---

## Testing Recommendations

1. Load unpacked extension from `extension/` after icons generated
2. Connect via `/connect-extension` flow
3. Visit ChatGPT with suggestions OFF — verify zero network calls in DevTools
4. Enable suggestions — verify debounced search, no duplicate intervals (Performance tab)
5. Drag FAB — verify smooth movement, position persists across reload
6. Toggle suggestions OFF — verify intervals stop (no recurring `findInputWithShadow` in profiler)
7. GitHub repo page — verify no FAB appears
8. GitHub Copilot chat — verify FAB appears
9. Save memory from FAB dialog — verify cache invalidation (list refreshes)
