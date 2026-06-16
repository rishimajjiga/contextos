// ContextOS Extension — Background Service Worker
// Handles all API calls to ContextOS backend

const DEFAULT_API_URL = "http://localhost:8000";

// MV3 keep-alive — low-frequency alarm (content scripts use ports when active)
chrome.alarms.create("keepAlive", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => {});

// Keep service worker reachable while content scripts are active
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "keepAlive") {
    port.onDisconnect.addListener(() => {});
  }
});

// ── Response cache & in-flight deduplication ─────────────────────────────────

const _cache = new Map();
const _inflight = new Map();

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function _cacheSet(key, data, ttlMs) {
  _cache.set(key, { data, expiry: Date.now() + ttlMs });
}

function _cacheInvalidate(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

async function dedupedRequest(key, fetcher) {
  const cached = _cacheGet(key);
  if (cached !== null) return cached;

  if (_inflight.has(key)) return _inflight.get(key);

  const promise = fetcher()
    .then((data) => {
      _inflight.delete(key);
      return data;
    })
    .catch((err) => {
      _inflight.delete(key);
      throw err;
    });

  _inflight.set(key, promise);
  return promise;
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.storage.sync.set({ autoInject: true });
});

// ── Floating popup window ─────────────────────────────────────────────────────
// Opens popup.html as a moveable window instead of the locked toolbar popup.

let _popupWindowId = null;

chrome.action.onClicked.addListener(async () => {
  // If already open, focus it
  if (_popupWindowId !== null) {
    try {
      await chrome.windows.update(_popupWindowId, { focused: true });
      return;
    } catch (_) {
      _popupWindowId = null; // window was closed — fall through to create
    }
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 360,
    height: 580,
    focused: true,
  });
  _popupWindowId = win.id;
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === _popupWindowId) _popupWindowId = null;
});

// ── Storage helpers ───────────────────────────────────────────────────────────

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiUrl", "apiKey"], (r) => {
      resolve({ apiUrl: r.apiUrl || DEFAULT_API_URL, apiKey: r.apiKey || "" });
    });
  });
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiRequest(path, method = "GET", body = null) {
  const { apiUrl, apiKey } = await getConfig();
  if (!apiKey) throw new Error("No API key — open Settings and paste your key.");

  let base = apiUrl;
  try { base = new URL(apiUrl).origin; } catch (_) {}

  const opts = {
    method,
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${base}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(
    (data) => sendResponse({ ok: true, data }),
    (err)  => sendResponse({ ok: false, error: err.message })
  );
  return true; // keep channel open for async response
});

async function handleMessage(msg) {
  switch (msg.type) {

    case "LIST_MEMORY": {
      const cacheKey = "list:page1:20";
      return dedupedRequest(cacheKey, async () => {
        const data = await apiRequest("/api/v1/documents?page=1&per_page=20");
        _cacheSet(cacheKey, data, 30_000);
        return data;
      });
    }

    case "SEARCH_MEMORY": {
      const query = (msg.query || "").trim().toLowerCase();
      const limit = msg.limit || 10;
      const cacheKey = `search:${query}:${limit}`;
      return dedupedRequest(cacheKey, async () => {
        const data = await apiRequest("/api/v1/search", "POST", { query: msg.query, limit });
        _cacheSet(cacheKey, data, 15_000);
        return data;
      });
    }

    case "SAVE_MEMORY": {
      const result = await apiRequest("/api/v1/documents", "POST", {
        title:    msg.title,
        content:  msg.content,
        doc_type: msg.doc_type || "note",
        tags:     msg.tags || [],
        visibility: "private",
      });
      _cacheInvalidate("list:");
      _cacheInvalidate("search:");
      _cacheInvalidate("context:");
      return result;
    }

    case "GET_CONTEXT": {
      const cacheKey = "context:merged";
      return dedupedRequest(cacheKey, async () => {
        const data = await apiRequest("/api/v1/documents?page=1&per_page=50");
        const items = data.items || [];
        if (!items.length) {
          const empty = { context: "" };
          _cacheSet(cacheKey, empty, 60_000);
          return empty;
        }
        const context = items
          .slice(0, 10)
          .map((d) => `[${d.title}]\n${(d.content || "").slice(0, 300)}`)
          .join("\n\n");
        const result = { context };
        _cacheSet(cacheKey, result, 60_000);
        return result;
      });
    }

    default:
      throw new Error(`Unknown message type: ${msg.type}`);
  }
}
