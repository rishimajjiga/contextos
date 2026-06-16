# ContextOS Project Audit

**Date:** 2026-06-16  
**Scope:** Full-stack audit — React frontend, FastAPI backend, Supabase, MCP server, Chrome extension  
**Objective:** Debug, optimize, and stabilize for production readiness without redesigning architecture or removing features.

---

## Executive Summary

ContextOS is a well-structured monorepo with clean separation between frontend (`frontend/`), backend (`backend/`), MCP server (`mcp-server/`), and Chrome extension (`extension/`). The architecture is sound. The primary production risk was **extension-induced lag on AI websites**, caused by always-on background activity, interval leaks, broad site injection, and uncached API calls.

All core features remain intact: authentication, profile/project memory, documents, search, API keys, settings, MCP tools, extension popup, floating widget, and context injection.

---

## Architecture Overview

| Layer | Stack | Entry Point |
|-------|-------|-------------|
| Frontend | React 18, Vite, TypeScript, Clerk, Zustand, Tailwind | `frontend/src/main.tsx` |
| Backend | FastAPI, SQLAlchemy async, Alembic, pgvector | `backend/app/main.py` |
| MCP Server | Python FastMCP, httpx | `mcp-server/server.py` |
| Extension | Chrome MV3, vanilla JS | `extension/manifest.json` |

---

## Problems Found

### Critical

| # | Area | Problem | Impact |
|---|------|---------|--------|
| 1 | Extension | `keepWorkerAlive()` ran on every AI tab every 20s regardless of user settings | Constant port churn, MV3 worker wakeups, CPU on all supported sites |
| 2 | Extension | `attachInputWatcher()` could be invoked multiple times (toggle ON, init, storage change) | Duplicate `setInterval` timers — memory/CPU leak |
| 3 | Extension | Three overlapping intervals (3s, 2s, 15s) for input detection | Unnecessary DOM scans every 2–3 seconds |
| 4 | Extension | Content script injected on **all** `github.com` and `x.com` pages | FAB + scripts on non-Copilot/non-Grok pages |
| 5 | Extension | `background.js` used `page_size` query param; backend expects `per_page` | Pagination silently ignored; extension always got default 20 items |
| 6 | Extension | No API response caching or in-flight deduplication | Duplicate search/list requests during typing and sidebar use |

### High

| # | Area | Problem | Impact |
|---|------|---------|--------|
| 7 | Extension | `styles.css` legacy `#ctx-fab` rules conflicted with inline FAB styles (`min-width: 140px`) | FAB layout jitter / oversized hit area |
| 8 | Extension | FAB drag wrote to `chrome.storage.sync` on every mousemove | Excessive storage I/O during drag |
| 9 | Extension | Global `document.click` listener always active for FAB menu | Minor overhead on every click |
| 10 | Backend | API key usage tracking committed to DB on **every** authenticated request | Extra DB round-trip per extension search keystroke |
| 11 | Extension | Extension icons missing from repo | Extension fails to load in Chrome without running `make-icons.py` |

### Medium

| # | Area | Problem | Impact |
|---|------|---------|--------|
| 12 | Extension | Broad `querySelectorAll` fallbacks ran on every input lookup | Layout thrashing on complex SPAs |
| 13 | Extension | No abort/stale-guard on in-flight suggestion searches | Race conditions showing wrong suggestions |
| 14 | Popup | Rapid search typing could render stale memory list results | Minor UI flicker |
| 15 | Backend | `get_db()` does not auto-commit; tracking uses explicit commit | Correct but doubles writes when unthrottled |

### Low / Informational

| # | Area | Problem | Impact |
|---|------|---------|--------|
| 16 | Extension | `cursor.com` not in manifest host permissions | Cursor web IDE not supported (VS Code web / GitHub Copilot are) |
| 17 | Connect flow | `connect.js` comment references `background.js onUpdated` handler that does not exist | Documentation drift only |
| 18 | Frontend | No request-level caching in Axios client | Acceptable; server state changes frequently |

---

## Root Causes

1. **Defensive over-polling for SPA input detection** — ChatGPT/Claude/Gemini recreate chat inputs on navigation; the extension compensated with aggressive multi-interval polling instead of a single lifecycle-managed watcher.

2. **No singleton guard on watcher** — Toggling auto-suggestions or storage sync events could spawn parallel watchers without teardown.

3. **Keep-alive treated as always-on** — Port-based MV3 keep-alive was intended for active suggestion mode but ran unconditionally at init.

4. **Broad host_permissions without page-level gating** — `github.com/*` and `x.com/*` match non-AI surfaces.

5. **API param drift** — Extension predated backend `per_page` convention; silent mismatch caused functional but suboptimal list behavior.

---

## Fixes Applied

### Extension (`extension/content.js`)

- Conditional keep-alive: only active when auto-suggestions are ON
- Port reconnect interval increased 20s → 45s; alarm 0.4min → 1min
- Input watcher singleton with `stopInputWatcher()` teardown
- Consolidated polling: 3s × 10 attempts max, then 20s SPA nav check only
- Platform gating for `github.com` (Copilot only) and `x.com` (Grok only)
- Input cache TTL 1s → 5s; broad DOM fallbacks separated from hot path
- FAB drag uses `requestAnimationFrame` + debounced storage writes (400ms)
- FAB menu click listener only attached while menu is open
- Search abort ID prevents stale suggestion toasts
- Suggestion debounce increased to 1800ms

### Extension (`extension/background.js`)

- Fixed `page_size` → `per_page`
- In-memory response cache (list 30s, search 15s, context 60s)
- In-flight request deduplication
- Cache invalidation on `SAVE_MEMORY`
- `chrome.runtime.onConnect` handler for `keepAlive` ports

### Extension (`extension/styles.css`, `popup.js`)

- Scoped legacy FAB CSS to avoid layout conflicts
- Popup memory list stale-request guard

### Backend

- `documents.py`: accepts `page_size` alias for backward compatibility
- `auth.py`: API key usage tracking throttled to once per 60s per key

### Build / Assets

- Generated missing extension icons via `make-icons.py`
- Frontend production build verified (`npm run build` ✓)

---

## Remaining Warnings

| Warning | Severity | Recommendation |
|---------|----------|----------------|
| Cursor (`cursor.com`) not in manifest | Low | Add host permission + platform config if web Cursor support is desired |
| `pytest` not installed in local Python env | Dev | Run `pip install -r requirements.txt` in backend venv for CI parity |
| Auto-suggestions MutationObserver still active on focused contenteditable | Low | Acceptable when ON; default is OFF |
| MV3 service worker may still sleep after 30s without keep-alive | Info | Only matters when suggestions ON; alarm provides backup |
| Razorpay billing endpoints present but excluded per requirements | Info | No changes made |
| GitHub Copilot on `github.com` requires Copilot UI to exist at init | Low | User may need to open Copilot panel once; 30s attach window covers late loads |

---

## Feature Verification Checklist

| Feature | Status | Notes |
|---------|--------|-------|
| Login / Signup (Clerk) | ✓ Preserved | Frontend auth flow unchanged |
| Settings | ✓ Preserved | API URL, API key, auto-inject |
| Profile save | ✓ Preserved | Backend + frontend hooks intact |
| Memory save | ✓ Preserved | Extension dialog + popup + API |
| Project save | ✓ Preserved | Projects API unchanged |
| Search | ✓ Preserved | Semantic search endpoint; extension cached |
| API keys | ✓ Preserved | Create/list/revoke flow intact |
| Extension popup | ✓ Preserved | Floating window via `chrome.windows.create` |
| Movable widget (FAB) | ✓ Improved | rAF drag, debounced position save |
| Context injection | ✓ Preserved | `injectIntoInput()` unchanged |
| Sync (storage) | ✓ Preserved | `chrome.storage.sync` for settings |
| MCP server tools | ✓ Preserved | `mcp-server/server.py` unchanged |

---

## Build Status

| Component | Command | Result |
|-----------|---------|--------|
| Frontend | `npm run build` | ✓ Pass |
| Backend tests | `pytest tests/` | ⚠ pytest not installed locally |
| Extension | Load unpacked `extension/` | ✓ Icons generated |

---

## Files Modified

- `extension/content.js` — performance + lifecycle fixes
- `extension/background.js` — caching, dedup, API param fix
- `extension/styles.css` — FAB conflict resolution
- `extension/popup.js` — stale request guard
- `extension/icons/*` — generated
- `backend/app/api/v1/endpoints/documents.py` — `page_size` alias
- `backend/app/middleware/auth.py` — tracking throttle
