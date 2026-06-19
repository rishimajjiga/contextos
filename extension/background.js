// ContextOS Extension — Background Service Worker v2
// All API calls go through here. Popup and content scripts message this worker.

const DEFAULT_API_URL = "http://localhost:8000";
const CACHE_TTL = { list: 30_000, search: 15_000, context: 60_000, projects: 45_000 };

// ── Keep-alive (MV3 service worker) ──────────────────────────────────────────
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => {});
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "keepAlive") port.onDisconnect.addListener(() => {});
});

// ── Response cache ────────────────────────────────────────────────────────────
const _cache = new Map();
const _inflight = new Map();

function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiry) { _cache.delete(key); return null; }
  return e.data;
}
function cacheSet(key, data, ttl) { _cache.set(key, { data, expiry: Date.now() + ttl }); }
function cacheInvalidate(...prefixes) {
  for (const key of _cache.keys())
    if (prefixes.some(p => key.startsWith(p))) _cache.delete(key);
}

async function deduped(key, fetcher) {
  const hit = cacheGet(key);
  if (hit !== null) return hit;
  if (_inflight.has(key)) return _inflight.get(key);
  const p = fetcher().finally(() => _inflight.delete(key));
  _inflight.set(key, p);
  return p;
}

// ── Tab URL watcher — catch #key= hash on /connect-extension ─────────────────
// This is the PRIMARY method for picking up the API key after the user
// signs in via the website. connect.js is the fallback (content-script approach).
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, _tab) => {
  const url = changeInfo.url || "";
  if (!url.includes("/connect-extension")) return;

  let parsed;
  try { parsed = new URL(url); } catch (_) { return; }

  const match = parsed.hash.match(/[#&]key=([^&]+)/);
  if (!match) return;

  const apiKey = decodeURIComponent(match[1]);
  if (!apiKey.startsWith("ctxos_")) return;

  // Prefer the explicit apiUrl passed in the hash (set by ConnectExtensionPage).
  // Fall back to deriving it from the frontend origin for older deployments.
  let apiUrl = DEFAULT_API_URL;
  const apiUrlMatch = parsed.hash.match(/[#&]apiUrl=([^&]+)/);
  if (apiUrlMatch) {
    try {
      apiUrl = new URL(decodeURIComponent(apiUrlMatch[1])).origin;
    } catch (_) {}
  } else {
    // Legacy fallback: guess backend URL from frontend origin
    try {
      const u = new URL(parsed.origin);
      if (u.port === "5173" || u.port === "5174") {
        apiUrl = `${u.protocol}//${u.hostname}:8000`;
      } else {
        apiUrl = u.origin;
      }
    } catch (_) {}
  }

  // Also read frontendUrl from the hash if provided
  let frontendUrl = "";
  const frontendUrlMatch = parsed.hash.match(/[#&]frontendUrl=([^&]+)/);
  if (frontendUrlMatch) {
    try { frontendUrl = new URL(decodeURIComponent(frontendUrlMatch[1])).origin; } catch (_) {}
  }

  const toSave = { apiKey, apiUrl };
  if (frontendUrl) toSave.frontendUrl = frontendUrl;

  chrome.storage.sync.set(toSave, () => {
    console.log("[ContextOS] API key + URLs saved via tabs.onUpdated.", { apiUrl, frontendUrl });
  });
});

// ── Install ───────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.storage.sync.set({ autoInject: true });
  // Right-click "Save to ContextOS" on any selected text
  chrome.contextMenus.create({
    id: "save-selection",
    title: "Save to ContextOS",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "save-page",
    title: "Save this page to ContextOS",
    contexts: ["page"],
  });
});

// ── Context menu handler ──────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { apiKey } = await getConfig();
  if (!apiKey) {
    // Not connected — open the extension popup
    chrome.action.openPopup?.();
    return;
  }

  if (info.menuItemId === "save-selection" && info.selectionText) {
    const title = (info.selectionText.slice(0, 60) + (info.selectionText.length > 60 ? "…" : ""))
      .replace(/\n/g, " ").trim();
    try {
      await apiRequest("/api/v1/memories", "POST", {
        title,
        content: info.selectionText,
        tags: ["quick-save"],
      });
      cacheInvalidate("list:", "search:", "context:");
      chrome.action.setBadgeText({ text: "✓", tabId: tab?.id });
      chrome.action.setBadgeBackgroundColor({ color: "#10B981" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
    } catch (err) {
      chrome.action.setBadgeText({ text: "!", tabId: tab?.id });
      chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
    }
  }

  if (info.menuItemId === "save-page" && tab?.url) {
    const title = (tab.title || tab.url).slice(0, 120);
    try {
      await apiRequest("/api/v1/memories", "POST", {
        title,
        content: `Source: ${tab.url}\n\nSaved from: ${tab.title || tab.url}`,
        tags: ["webpage"],
      });
      cacheInvalidate("list:", "search:", "context:");
      chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#10B981" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
    } catch (_) {}
  }
});

// ── Storage helpers ───────────────────────────────────────────────────────────
async function getConfig() {
  return new Promise((resolve) =>
    chrome.storage.sync.get(["apiUrl", "apiKey"], (r) =>
      resolve({ apiUrl: r.apiUrl || DEFAULT_API_URL, apiKey: r.apiKey || "" })
    )
  );
}

// ── Core fetch with retry ─────────────────────────────────────────────────────
async function apiRequest(path, method = "GET", body = null, retries = 2) {
  const { apiUrl, apiKey } = await getConfig();

  if (!apiKey) {
    throw new Error("NOT_CONFIGURED: Open ContextOS and connect your account first.");
  }

  let base = apiUrl || DEFAULT_API_URL;
  try { base = new URL(base).origin; } catch (_) {
    base = DEFAULT_API_URL;
  }

  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);

  let res;
  let lastNetworkErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      res = await fetch(`${base}${path}`, opts);
      lastNetworkErr = null;
      break; // success
    } catch (networkErr) {
      lastNetworkErr = networkErr;
      if (attempt < retries) {
        // Exponential backoff: 500ms, 1000ms
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  if (lastNetworkErr) {
    const msg = (lastNetworkErr && lastNetworkErr.message) || "";
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("fetch")) {
      throw new Error(
        `NETWORK_ERROR: Cannot reach ContextOS at ${base}. ` +
        `Check your API URL in Settings is correct (should be your Railway backend URL).`
      );
    }
    throw lastNetworkErr;
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("AUTH_ERROR: Invalid API key. Go to Settings and re-enter your key.");
  }
  if (res.status === 402) {
    let detail = {};
    try { detail = await res.json(); } catch (_) {}
    const e = new Error(`LIMIT_REACHED: ${detail.detail || "Plan limit reached."}`);
    e.limit = detail.limit;
    e.plan  = detail.plan;
    throw e;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API_ERROR ${res.status}: ${text}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

// ── Message router ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(
    (data) => sendResponse({ ok: true,  data }),
    (err)  => sendResponse({ ok: false, error: err.message })
  );
  return true; // keep channel open
});

async function handleMessage(msg) {
  switch (msg.type) {

    // ── Documents (memories) ─────────────────────────────────────────────────

    case "LIST_MEMORY": {
      const perPage = msg.perPage || 20;
      const key = `list:${perPage}`;
      return deduped(key, async () => {
        // API returns an array directly
        const data = await apiRequest(`/api/v1/memories?limit=${perPage}`);
        cacheSet(key, data, CACHE_TTL.list);
        return data;
      });
    }

    case "SEARCH_MEMORY": {
      const q     = (msg.query || "").trim();
      const limit = msg.limit || 20;
      const key   = `search:${q.toLowerCase()}`;
      return deduped(key, async () => {
        // GET with ?q= for server-side title/content search
        const enc  = encodeURIComponent(q);
        const data = await apiRequest(`/api/v1/memories?q=${enc}&limit=${limit}`);
        cacheSet(key, data, CACHE_TTL.search);
        return data;
      });
    }

    case "SAVE_MEMORY": {
      const result = await apiRequest("/api/v1/memories", "POST", {
        title:      msg.title,
        content:    msg.content,
        tags:       msg.tags       || [],
        project_id: msg.project_id || null,
      });
      cacheInvalidate("list:", "search:", "context:");
      return result;
    }

    case "DELETE_MEMORY": {
      await apiRequest(`/api/v1/memories/${msg.id}`, "DELETE");
      cacheInvalidate("list:", "search:", "context:");
      return { deleted: true };
    }

    // ── Projects ─────────────────────────────────────────────────────────────

    case "LIST_PROJECTS": {
      const key = "projects:list";
      return deduped(key, async () => {
        const data = await apiRequest("/api/v1/projects?page=1&per_page=50");
        cacheSet(key, data, CACHE_TTL.projects);
        return data;
      });
    }

    case "GET_PROJECT": {
      const key = `project:${msg.id}`;
      return deduped(key, async () => {
        const data = await apiRequest(`/api/v1/projects/${msg.id}`);
        cacheSet(key, data, CACHE_TTL.projects);
        return data;
      });
    }

    case "CREATE_PROJECT": {
      const result = await apiRequest("/api/v1/projects", "POST", {
        name:        msg.name,
        description: msg.description || "",
        stack:       [],
        goals:       "",
        architecture:  "",
        coding_style:  "",
        active_tasks:  [],
        current_problems: [],
      });
      cacheInvalidate("projects:");
      return result;
    }

    // ── Context (AI auto-inject) ──────────────────────────────────────────────

    case "GET_CONTEXT": {
      const key = "context:merged";
      return deduped(key, async () => {
        // API returns an array directly
        const data = await apiRequest("/api/v1/memories?limit=50");
        const items = Array.isArray(data) ? data : (data.items || []);
        const context = items
          .slice(0, 10)
          .map((d) => `[${d.title}]\n${(d.content || "").slice(0, 300)}`)
          .join("\n\n---\n\n");
        const result = { context, count: items.length };
        cacheSet(key, result, CACHE_TTL.context);
        return result;
      });
    }

    // ── Health check ──────────────────────────────────────────────────────────

    case "HEALTH_CHECK": {
      const { apiUrl } = await getConfig();
      let base = apiUrl || DEFAULT_API_URL;
      try { base = new URL(base).origin; } catch (_) { base = DEFAULT_API_URL; }
      let res;
      try {
        res = await fetch(`${base}/health`, { method: "GET" });
      } catch (e) {
        throw new Error(`NETWORK_ERROR: Cannot reach ${base}. Make sure the backend is running.`);
      }
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      return res.json();
    }

    // ── Website bridge — auto-connect via Clerk JWT ───────────────────────────
    // Sent by website-bridge.js when the user is signed into the ContextOS web app.
    // If no API key is stored, we use the Clerk JWT to create one automatically.
    case "STORE_CLERK_TOKEN": {
      const { token, apiUrl: tokenApiUrl } = msg;
      if (!token) return { saved: false, reason: "no_token" };

      // Don't overwrite an existing API key — user is already connected
      const { apiKey } = await getConfig();
      if (apiKey) return { saved: false, reason: "already_configured" };

      const base = tokenApiUrl || DEFAULT_API_URL;
      let res;
      try {
        res = await fetch(`${base}/api/v1/api-keys`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ name: "Chrome Extension" }),
        });
      } catch (e) {
        return { saved: false, reason: "network_error" };
      }
      if (!res.ok) return { saved: false, reason: `http_${res.status}` };

      const created = await res.json();
      await chrome.storage.sync.set({ apiKey: created.key, apiUrl: base });
      cacheInvalidate("list:", "search:", "context:", "projects:");
      console.log("[ContextOS] Auto-connected via Clerk JWT.");
      return { saved: true };
    }


    