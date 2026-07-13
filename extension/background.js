// ContextOS Extension — Background Service Worker v2
// All API calls go through here. Popup and content scripts message this worker.

const DEFAULT_API_URL = "https://api.usecontextos.com";
const CACHE_TTL = { list: 30_000, search: 15_000, context: 60_000, projects: 45_000 };

// ── Keep-alive (MV3 service worker) ──────────────────────────────────────────
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => { flushSaveQueue(); });
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "keepAlive") port.onDisconnect.addListener(() => {});
});

// ── Response cache ────────────────────────────────────────────────────────────
const _cache = new Map();
const _inflight = new Map();
let _epoch = 0; // bumped on every invalidation so in-flight fetches can't re-cache stale data

function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiry) { _cache.delete(key); return null; }
  return e.data;
}
function cacheSet(key, data, ttl) { _cache.set(key, { data, expiry: Date.now() + ttl }); }
function cacheInvalidate(...prefixes) {
  _epoch++;
  for (const key of _cache.keys())
    if (prefixes.some(p => key.startsWith(p))) _cache.delete(key);
  // Also drop matching in-flight fetches so the next request starts fresh.
  for (const key of _inflight.keys())
    if (prefixes.some(p => key.startsWith(p))) _inflight.delete(key);
}

async function deduped(key, fetcher) {
  const hit = cacheGet(key);
  if (hit !== null) return hit;
  if (_inflight.has(key)) return _inflight.get(key);
  const startEpoch = _epoch;
  const p = fetcher()
    .then((data) => { if (_epoch !== startEpoch) _cache.delete(key); return data; })
    .finally(() => _inflight.delete(key));
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
    // Close every /connect-extension tab (including duplicates) once the key
    // is saved. The popup's own poll can't do this reliably — the popup closes
    // as soon as the auth window takes focus. Small delay so the page's
    // "Connected!" state is visible first.
    setTimeout(() => {
      chrome.tabs.query({ url: "*://*/connect-extension*" }, (tabs) => {
        (tabs || []).forEach((t) => { try { chrome.tabs.remove(t.id); } catch (_) {} });
      });
    }, 1600);
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
  chrome.contextMenus.create({
    id: "save-link",
    title: "Save link to ContextOS",
    contexts: ["link"],
  });
  // Team-save variants — only do anything for active Team-plan members; the
  // backend authorizes membership, so these are safe to always show.
  chrome.contextMenus.create({
    id: "save-selection-team",
    title: "Save selection to Team",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "save-page-team",
    title: "Save this page to Team",
    contexts: ["page"],
  });
  // "Open Movable Brain" — opens the floating panel prefilled with selected text
  chrome.contextMenus.create({
    id: "open-brain-with-selection",
    title: "Open Movable Brain",
    contexts: ["selection"],
  });
});

// ── Clip builder ──────────────────────────────────────────────────────────────
// Builds a memory payload from a text selection: the SELECTED TEXT is the
// content, the PAGE TITLE is the title, and the SOURCE URL is preserved as a
// footer (the backend has no dedicated url column). Works on any website.
function _hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (_) { return ""; }
}
function buildSelectionPayload(info, tab, visibility) {
  const pageTitle = (tab && tab.title ? tab.title : "").trim();
  const pageUrl   = (tab && tab.url) ? tab.url : "";
  const snippet   = (info.selectionText || "").trim();
  const title     = (pageTitle || snippet.slice(0, 80) || "Clipped text")
                      .replace(/\s+/g, " ").slice(0, 200);
  const content   = pageUrl ? `${snippet}\n\nSource: ${pageUrl}` : snippet;
  const host = _hostname(pageUrl);
  const payload = { title, content, tags: ["clipped", host].filter(Boolean) };
  if (visibility === "team") payload.visibility = "team";
  return payload;
}

// Builds a memory payload from a right-clicked link. The link URL is the content
// (short); the page it was found on is noted briefly.
function buildLinkPayload(info, tab, visibility) {
  const linkUrl  = info.linkUrl || "";
  const linkText = (info.selectionText || "").trim();
  const pageUrl  = (tab && tab.url) ? tab.url : "";
  const linkHost = _hostname(linkUrl);
  const title    = (linkText || linkHost || "Saved link").replace(/\s+/g, " ").slice(0, 200);
  const content  = `${linkUrl}${pageUrl ? `\n\nFound on: ${pageUrl}` : ""}`;
  const payload  = { title, content, tags: ["link", linkHost].filter(Boolean) };
  if (visibility === "team") payload.visibility = "team";
  return payload;
}

// ── Context menu handler ──────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { apiKey } = await getConfig();
  if (!apiKey) {
    // Not connected — open the extension popup
    chrome.action.openPopup?.();
    return;
  }

  if (info.menuItemId === "save-selection" && info.selectionText) {
    setSaveDestination("personal");
    try {
      await apiRequest("/api/v1/memories", "POST", buildSelectionPayload(info, tab, "personal"));
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

  if (info.menuItemId === "open-brain-with-selection") {
    // Tell the content script to open the floating brain panel with prefilled text.
    // User sees the form and clicks Save manually — nothing is auto-saved here.
    chrome.tabs.sendMessage(tab.id, {
      type: "OPEN_PANEL_WITH_SELECTION",
      text:  info.selectionText || "",
      title: tab.title         || "",
    }, function() {
      if (chrome.runtime.lastError) {} // no content script on this page — ignore
    });
    return;
  }

  if (info.menuItemId === "save-page" && tab?.url) {
    setSaveDestination("personal");
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

  if (info.menuItemId === "save-link" && info.linkUrl) {
    const dest = await getSaveDestination();   // honour the user's last Personal/Team choice
    try {
      await apiRequest("/api/v1/memories", "POST", buildLinkPayload(info, tab, dest));
      cacheInvalidate("list:", "search:", "context:");
      chrome.action.setBadgeText({ text: dest === "team" ? "👥" : "✓", tabId: tab?.id });
      chrome.action.setBadgeBackgroundColor({ color: "#10B981" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
    } catch (err) {
      chrome.action.setBadgeText({ text: "!", tabId: tab?.id });
      chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
    }
  }

  // ── Team save variants ──────────────────────────────────────────────────────
  if (info.menuItemId === "save-selection-team" && info.selectionText) {
    setSaveDestination("team");
    try {
      await apiRequest("/api/v1/memories", "POST", buildSelectionPayload(info, tab, "team"));
      cacheInvalidate("list:", "search:", "context:");
      chrome.action.setBadgeText({ text: "👥", tabId: tab?.id });
      chrome.action.setBadgeBackgroundColor({ color: "#10B981" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
    } catch (err) {
      chrome.action.setBadgeText({ text: "!", tabId: tab?.id });
      chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
    }
  }

  if (info.menuItemId === "save-page-team" && tab?.url) {
    setSaveDestination("team");
    const title = (tab.title || tab.url).slice(0, 120);
    try {
      await apiRequest("/api/v1/memories", "POST", {
        title,
        content: `Source: ${tab.url}\n\nSaved from: ${tab.title || tab.url}`,
        tags: ["webpage"], visibility: "team",
      });
      cacheInvalidate("list:", "search:", "context:");
      chrome.action.setBadgeText({ text: "👥", tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#10B981" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
    } catch (_) {
      chrome.action.setBadgeText({ text: "!", tabId: tab?.id });
      chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
    }
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

// ── Team save destination (quick-save) ────────────────────────────────────────
// Remembers the user's last chosen save destination so the next save defaults
// to it. "personal" (default) | "team". Stored in chrome.storage.local.
async function getSaveDestination() {
  return new Promise((resolve) =>
    chrome.storage.local.get(["saveDestination"], (r) => resolve(r.saveDestination === "team" ? "team" : "personal"))
  );
}
async function setSaveDestination(dest) {
  const d = dest === "team" ? "team" : "personal";
  await new Promise((r) => chrome.storage.local.set({ saveDestination: d }, r));
  return d;
}

// Cached lookup of the user's team (org). 5-min in-memory cache so we never add
// an API call to the save path. Returns { id, name } or null.
let _teamCache = { info: undefined, expiry: 0 };
async function getActiveTeam() {
  if (_teamCache.info !== undefined && Date.now() < _teamCache.expiry) return _teamCache.info;
  try {
    const org = await apiRequest("/api/v1/organizations");
    const info = (org && org.id) ? { id: org.id, name: org.name } : null;
    _teamCache = { info, expiry: Date.now() + 5 * 60 * 1000 };
    return info;
  } catch (_) {
    return null;  // not on a team / not reachable — treat as personal-only
  }
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
// ── Offline save queue ────────────────────────────────────────────────────────
// When SAVE_MEMORY fails with a network error we queue the payload in
// chrome.storage.local so it can be retried on the next keepAlive tick.

async function flushSaveQueue() {
  const { saveQueue = [] } = await new Promise(r => chrome.storage.local.get("saveQueue", r));
  if (!saveQueue.length) return;
  const remaining = [];
  for (const item of saveQueue) {
    try {
      const result = await apiRequest("/api/v1/memories", "POST", item);
      cacheInvalidate("list:", "search:", "context:");
      await chrome.storage.local.set({ lastSave: Date.now() });
    } catch (_) {
      remaining.push(item);  // still offline — keep in queue
    }
  }
  await new Promise(r => chrome.storage.local.set({ saveQueue: remaining }, r));
}

// Flush any queued saves on extension startup too
chrome.runtime.onStartup.addListener(flushSaveQueue);

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
      // Destination: explicit msg.visibility wins, else the remembered default
      // (quick-save). Personal payloads are byte-identical to before (no
      // visibility field) → 100% backward compatible.
      const dest = (msg.visibility === "team" || msg.visibility === "personal")
        ? msg.visibility
        : await getSaveDestination();
      const payload = {
        title:      msg.title,
        content:    msg.content,
        tags:       msg.tags       || [],
        project_id: msg.project_id || null,
      };
      if (dest === "team") {
        payload.visibility = "team";
        if (msg.team_id) payload.team_id = msg.team_id;
      }
      try {
        const result = await apiRequest("/api/v1/memories", "POST", payload);
        cacheInvalidate("list:", "search:", "context:");
        // Stamp storage so open website tabs know to refetch
        await chrome.storage.local.set({ lastSave: Date.now() });
        return result;
      } catch (err) {
        // Queue for retry when network returns
        if (err.message.includes("NETWORK_ERROR")) {
          const { saveQueue = [] } = await new Promise(r => chrome.storage.local.get("saveQueue", r));
          const isDup = saveQueue.some(q => q.title === payload.title && q.content === payload.content);
          if (!isDup) {
            saveQueue.push(payload);
            await new Promise(r => chrome.storage.local.set({ saveQueue }, r));
          }
          throw new Error("QUEUED: Unable to sync right now. Will retry automatically.");
        }
        throw err;
      }
    }

    // ── Team / save destination ──────────────────────────────────────────────
    case "TEAM_INFO": {
      const team = await getActiveTeam();
      const destination = await getSaveDestination();
      return { hasTeam: !!team, team, destination };
    }

    case "GET_SAVE_DESTINATION": {
      return { destination: await getSaveDestination() };
    }

    case "SET_SAVE_DESTINATION": {
      return { destination: await setSaveDestination(msg.destination) };
    }

    case "DELETE_MEMORY": {
      await apiRequest(`/api/v1/memories/${msg.id}`, "DELETE");
      cacheInvalidate("list:", "search:", "context:");
      await chrome.storage.local.set({ lastSave: Date.now() });
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

    // ── Plan info ─────────────────────────────────────────────────────────────
    case "GET_PLAN": {
      return apiRequest("/api/v1/billing/plan");
    }

    // ── Current user ──────────────────────────────────────────────────────────
    case "GET_USER_INFO": {
      return apiRequest("/api/v1/users/me");
    }

    // ── Cache invalidation (called by website-bridge when website saves) ───────
    case "INVALIDATE_CACHE": {
      cacheInvalidate("list:", "search:", "context:", "projects:");
      return { ok: true };
    }
  }
}
