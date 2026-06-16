// ContextOS Popup Script

// ── Tab switching ─────────────────────────────────────────────────────────────

document.querySelectorAll(".tab").forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    if (tab.dataset.tab === "memories") loadMemories("");
    if (tab.dataset.tab === "settings") loadSettings();
    if (tab.dataset.tab === "save") initSaveTab();
  };
});

// ── API helper ────────────────────────────────────────────────────────────────

function sendMsg(type, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...data }, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (!res.ok) reject(new Error(res.error));
      else resolve(res.data);
    });
  });
}

// ── Memories tab ──────────────────────────────────────────────────────────────

let _memoriesRequestId = 0;

const TYPE_BADGE = {
  note:      "type-note",
  code:      "type-code",
  reference: "type-reference",
  idea:      "type-idea",
};

async function loadMemories(query) {
  const list = document.getElementById("memory-list");
  if (!list) return;
  list.innerHTML = '<div class="status-msg">Loading…</div>';
  const requestId = ++_memoriesRequestId;
  try {
    let items;
    if (query.trim()) {
      const data = await sendMsg("SEARCH_MEMORY", { query, limit: 10 });
      items = Array.isArray(data) ? data : (data.results || []);
    } else {
      const data = await sendMsg("LIST_MEMORY");
      items = data.items || [];
    }
    if (requestId !== _memoriesRequestId) return;
    if (!items?.length) {
      list.innerHTML = '<div class="status-msg">No memories yet. Save one!</div>';
      return;
    }
    list.innerHTML = items.map((doc) => {
      const typeClass = TYPE_BADGE[doc.doc_type] || "type-note";
      const tagsHtml = doc.tags?.length
        ? `<div class="memory-item-tags">${doc.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`
        : "";
      return `
        <div class="memory-item">
          <div class="memory-item-title">${esc(doc.title || "Untitled")}</div>
          <div class="memory-item-preview">${esc((doc.content || "").slice(0, 110))}${(doc.content?.length ?? 0) > 110 ? "…" : ""}</div>
          <div class="memory-item-meta">
            <span class="memory-type-badge ${typeClass}">${doc.doc_type || "note"}</span>
            ${tagsHtml}
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    if (requestId !== _memoriesRequestId) return;
    if (isLimitError(err)) {
      list.innerHTML = `
        <div class="upgrade-banner">
          <div class="upgrade-banner-title">🔒 Memory limit reached</div>
          <div class="upgrade-banner-sub">You've used all ${err.limit || 10} memories on the Free plan.<br>Upgrade to store up to 500 memories.</div>
          <button class="upgrade-banner-btn" id="list-upgrade-btn">⚡ Upgrade to Pro</button>
        </div>`;
      getUpgradeUrl().then(url => {
        document.getElementById("list-upgrade-btn")?.addEventListener("click", () => chrome.tabs.create({ url }));
      });
    } else {
      list.innerHTML = `<div class="status-msg error">⚠ ${esc(err.message)}</div>`;
    }
  }
}

const searchInput = document.getElementById("search-input");
document.getElementById("search-btn").onclick = () => loadMemories(searchInput.value);
let debounce;
searchInput.oninput = () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => loadMemories(searchInput.value), 380);
};

// ── Save tab ──────────────────────────────────────────────────────────────────

let selectedType = "note";
let tagsList = [];
let currentPageUrl = "";

// Type chip selection
document.querySelectorAll(".type-chip").forEach((chip) => {
  chip.onclick = () => {
    document.querySelectorAll(".type-chip").forEach((c) => {
      c.className = "type-chip"; // reset
    });
    selectedType = chip.dataset.type;
    chip.classList.add(`active-${selectedType}`);
  };
});

// Character counter
const saveContent = document.getElementById("save-content");
const charCounter = document.getElementById("char-counter");
const charBar = document.getElementById("char-bar");

if (saveContent && charCounter && charBar) {
  saveContent.oninput = () => {
    const len = saveContent.value.length;
    charCounter.textContent = `${len} / 4000`;
    const pct = Math.min(100, (len / 4000) * 100);
    charBar.style.width = `${pct}%`;
    
    if (len > 4000) {
      charCounter.className = "char-counter over";
      charBar.style.background = "#EF4444";
    } else if (len > 3500) {
      charCounter.className = "char-counter warn";
      charBar.style.background = "#F59E0B";
    } else {
      charCounter.className = "char-counter";
      charBar.style.background = "#6366F1";
    }
  };
}

// Tags pill logic
const tagInput = document.getElementById("save-tags-input");
document.getElementById("tags-area")?.addEventListener("click", () => tagInput.focus());
tagInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const val = tagInput.value.trim().replace(/,$/, "");
    if (val && !tagsList.includes(val)) {
      tagsList.push(val);
      renderTagPills();
    }
    tagInput.value = "";
  }
  if (e.key === "Backspace" && !tagInput.value && tagsList.length) {
    tagsList.pop();
    renderTagPills();
  }
});

function renderTagPills() {
  const container = document.getElementById("tags-area");
  container.innerHTML = tagsList.map((t, i) => `
    <span class="tag-pill">
      ${esc(t)}
      <span class="tag-pill-x" data-i="${i}">×</span>
    </span>`).join("");
  container.querySelectorAll(".tag-pill-x").forEach((x) => {
    x.onclick = () => { tagsList.splice(+x.dataset.i, 1); renderTagPills(); };
  });
}

// Page capture bar — populate from active tab
function initSaveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith("chrome://")) return;
    currentPageUrl = tab.url;
    const bar = document.getElementById("page-capture-bar");
    document.getElementById("page-title-text").textContent = tab.title || tab.url;
    const domainEl = document.getElementById("page-domain-text");
    if (domainEl) domainEl.textContent = new URL(tab.url).hostname;
    document.getElementById("page-favicon").src =
      `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=32`;
    document.getElementById("page-favicon").onerror = () => {
      document.getElementById("page-favicon").style.display = "none";
    };
    bar.style.display = "flex";
    bar.onclick = () => {
      const titleEl = document.getElementById("save-title");
      const contentEl = document.getElementById("save-content");
      if (!titleEl.value) titleEl.value = tab.title || "";
      if (!contentEl.value) {
        contentEl.value = `Source: ${tab.url}`;
        saveContent.dispatchEvent(new Event("input"));
      }
      bar.style.opacity = "0.5";
      bar.style.pointerEvents = "none";
    };
  });
}

// Save button
document.getElementById("save-btn").onclick = async () => {
  const title   = document.getElementById("save-title").value.trim();
  const content = saveContent.value.trim();
  const status  = document.getElementById("save-status");

  if (!title || !content) {
    setStatus(status, "Title and content are required.", "error");
    return;
  }

  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.textContent = "Saving…";
  setStatus(status, "", "");

  try {
    await sendMsg("SAVE_MEMORY", {
      title,
      content,
      doc_type: selectedType,
      tags: [...tagsList],
    });
    showSaveSuccess(title);
  } catch (err) {
    if (isLimitError(err)) {
      showUpgradeBanner(status);
    } else {
      setStatus(status, `✗ ${err.message}`, "error");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Save Memory";
  }
};

function showSaveSuccess(title) {
  document.getElementById("save-form").style.display = "none";
  const successEl = document.getElementById("save-success");
  document.getElementById("success-sub").textContent =
    `"${title}" is now in your AI context.`;
  successEl.classList.add("show");
}

document.getElementById("view-memories-btn")?.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="memories"]').classList.add("active");
  document.getElementById("tab-memories").classList.add("active");
  document.getElementById("save-success").classList.remove("show");
  document.getElementById("save-form").style.display = "";
});
document.getElementById("save-another-btn").onclick = () => {
  // Reset form
  document.getElementById("save-title").value = "";
  saveContent.value = "";
  charCounter.textContent = "0 / 4000";
  tagsList = [];
  renderTagPills();
  tagInput.value = "";
  selectedType = "note";
  document.querySelectorAll(".type-chip").forEach((c) => c.className = "type-chip");
  document.querySelector('[data-type="note"]').classList.add("active-note");
  const bar = document.getElementById("page-capture-bar");
  bar.style.opacity = "";
  bar.style.pointerEvents = "";
  document.getElementById("save-form").style.display = "";
  document.getElementById("save-success").classList.remove("show");
  setStatus(document.getElementById("save-status"), "", "");
};

// ── Settings tab ──────────────────────────────────────────────────────────────

async function loadSettings() {
  const { apiUrl, apiKey, autoInject } = await new Promise((r) =>
    chrome.storage.sync.get(["apiUrl", "apiKey", "autoInject"], r)
  );
  document.getElementById("api-url").value   = apiUrl   || "";
  document.getElementById("api-key").value   = apiKey   || "";
  document.getElementById("auto-inject").checked = (autoInject === undefined) ? true : !!autoInject;
}

document.getElementById("save-settings-btn").onclick = async () => {
  const apiUrl    = document.getElementById("api-url").value.trim().replace(/\/$/, "");
  const apiKey    = document.getElementById("api-key").value.trim();
  const autoInject = document.getElementById("auto-inject").checked;
  const status    = document.getElementById("settings-status");
  await new Promise((r) => chrome.storage.sync.set({ apiUrl, apiKey, autoInject }, r));
  setStatus(status, "✓ Settings saved!", "success");
  init();
};

document.getElementById("test-btn").onclick = async () => {
  const status = document.getElementById("settings-status");
  setStatus(status, "Testing…", "");
  try {
    await sendMsg("LIST_MEMORY");
    setStatus(status, "✓ Connected to ContextOS!", "success");
  } catch (err) {
    setStatus(status, `✗ ${err.message}`, "error");
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLimitError(err) {
  const m = err.message || "";
  return m.includes("LIMIT_REACHED") || m.includes("402") || m.includes("limit");
}

async function getUpgradeUrl() {
  const { apiUrl } = await new Promise((r) => chrome.storage.sync.get(["apiUrl"], r));
  try {
    const u    = new URL(apiUrl || "http://localhost:8000");
    const port = u.port === "8000" ? "5173" : u.port;
    return `${u.protocol}//${u.hostname}${port ? ":" + port : ""}/pricing`;
  } catch { return "http://localhost:5173/pricing"; }
}

function showUpgradeBanner(statusEl) {
  statusEl.innerHTML = `
    <div style="color:#F87171;font-size:12px;font-weight:700;margin-bottom:8px">Memory limit reached</div>
    <button id="upgrade-link" style="
      display:inline-flex;align-items:center;gap:6px;
      background:linear-gradient(135deg,#6366F1,#8B5CF6);
      border:none;border-radius:9px;color:#fff;cursor:pointer;
      font-size:12px;font-weight:700;padding:9px 20px;
      box-shadow:0 4px 14px rgba(99,102,241,0.45);
    ">⚡ Upgrade to Pro</button>`;
  statusEl.className = "status-msg";
  getUpgradeUrl().then((url) => {
    const btn = document.getElementById("upgrade-link");
    if (btn) btn.onclick = () => chrome.tabs.create({ url });
  });
}

function setStatus(el, msg, type) {
  el.textContent = msg;
  el.className   = "status-msg" + (type ? " " + type : "");
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Screen management ─────────────────────────────────────────────────────────

const screenLogin = document.getElementById("screen-login");
const screenMain  = document.getElementById("screen-main");

function showScreen(name) {
  screenLogin.classList.toggle("visible", name === "login");
  screenMain.classList.toggle("visible",  name === "main");
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  // Show version in header
  try {
    const v = chrome.runtime.getManifest().version;
    const el = document.getElementById("header-version");
    if (el) el.textContent = "AI Memory Layer · v" + v;
  } catch (_) {}

  const { apiUrl, apiKey } = await new Promise((r) =>
    chrome.storage.sync.get(["apiUrl", "apiKey"], r)
  );

  if (!apiUrl || !apiKey) {
    showScreen("login");
    const connectBtn  = document.getElementById("connect-btn");
    const connectStatus = document.getElementById("connect-status");
    if (connectBtn) connectBtn.onclick = async () => {
      connectBtn.disabled = true;
      connectBtn.textContent = "Opening…";
      if (connectStatus) connectStatus.textContent = "Sign in to your ContextOS account in the new tab.";

      // Resolve frontend URL from stored apiUrl (backend port → frontend port)
      const stored = await new Promise(r => chrome.storage.sync.get(["apiUrl"], r));
      let frontendBase = "http://localhost:5173";
      try {
        const u = new URL(stored.apiUrl || "http://localhost:8000");
        const port = u.port === "8000" ? "5173" : (u.port || "");
        frontendBase = u.protocol + "//" + u.hostname + (port ? ":" + port : "");
      } catch (_) {}

      // Open the connect-extension page in a new tab
      const tab = await chrome.tabs.create({ url: frontendBase + "/connect-extension", active: true });

      // Poll storage every second for up to 2 minutes waiting for the key
      let waited = 0;
      const poll = setInterval(async () => {
        waited++;
        const r = await new Promise(res => chrome.storage.sync.get(["apiKey"], res));
        if (r.apiKey) {
          clearInterval(poll);
          try { await chrome.tabs.remove(tab.id); } catch (_) {}
          // Reload popup with the new key
          window.location.reload();
        } else if (waited > 120) {
          clearInterval(poll);
          connectBtn.disabled = false;
          connectBtn.textContent = "Connect with ContextOS →";
          if (connectStatus) connectStatus.textContent = "Timed out — try again.";
        }
      }, 1000);
    };
    return;
  }

  showScreen("main");
  loadMemories("");
}

init();
