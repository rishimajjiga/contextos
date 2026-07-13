// ContextOS Popup v2 — Second Brain

// ── Utilities ─────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function sendMsg(type, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...data }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!res) { reject(new Error("No response from background")); return; }
      if (!res.ok) {
        const err = new Error(res.error || "Unknown error");
        // Attach metadata for limit errors
        if (res.error && res.error.includes("LIMIT_REACHED")) {
          const m = res.error.match(/limit:(\d+)/);
          if (m) err.limit = +m[1];
        }
        // Additive: any API call failing with a usage-limit error surfaces the
        // key-limit modal (the health check is unauthenticated and never sees
        // these, so detection must live here, at the single error funnel).
        try { maybeShowKeyLimitModal(err); } catch (_) {}
        reject(err);
      } else {
        resolve(res.data);
      }
    });
  });
}

function setStatus(el, msg, type = "") {
  if (!el) return;
  el.textContent = msg;
  el.className = "status" + (type ? " " + type : "");
}

// Inject text into the active AI-tool tab's chat input via content script
function injectIntoPage(text) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: "INJECT_TEXT", text }, () => {
      if (chrome.runtime.lastError) {
        // Content script not on this page — open popup to a supported AI tab
        console.warn("[ContextOS] Inject failed:", chrome.runtime.lastError.message);
      }
    });
  });
}

function getBadgeClass(docType) {
  const map = {
    note:"badge-note", code:"badge-code", research:"badge-research",
    reference:"badge-reference", prompt:"badge-prompt", idea:"badge-note",
    other:"badge-other", pdf:"badge-research",
  };
  return map[docType] || "badge-other";
}

function isNetworkError(err) {
  return err.message.includes("NETWORK_ERROR") || err.message.includes("Failed to fetch");
}

function isAuthError(err) {
  return err.message.includes("AUTH_ERROR") || err.message.includes("NOT_CONFIGURED");
}

function friendlyError(err) {
  const m = err.message || "";
  if (m.includes("NOT_CONFIGURED")) return "Not connected. Go to Settings.";
  if (m.includes("NETWORK_ERROR"))  return "Unable to sync right now. Please try again in a few moments.";
  if (m.includes("QUEUED"))         return "Offline — saved locally, will sync automatically when reconnected.";
  if (m.includes("AUTH_ERROR"))     return "Bad API key. Check Settings.";
  if (m.includes("LIMIT_REACHED"))  return "Plan limit reached. Upgrade to save more.";
  return m.replace(/^(API_ERROR \d+:|NETWORK_ERROR:|AUTH_ERROR:|QUEUED:)\s*/,"");
}

// ── Navigation ────────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  const btn = document.querySelector(`.nav-btn[data-tab="${name}"]`);
  const panel = document.getElementById(`panel-${name}`);
  if (btn)   btn.classList.add("active");
  if (panel) panel.classList.add("active");

  if (name === "memories")  loadMemories();
  if (name === "projects")  loadProjects();
  if (name === "save")      initSaveTab();
  if (name === "settings")  loadSettings();
  if (name === "search")    document.getElementById("search-input")?.focus();
}

document.querySelectorAll(".nav-btn").forEach(b => {
  b.onclick = () => switchTab(b.dataset.tab);
});

// ── Status dot ────────────────────────────────────────────────────────────────

async function refreshStatusDot() {
  const dot  = document.getElementById("hdr-dot");
  const text = document.getElementById("hdr-status-text");
  try {
    await sendMsg("HEALTH_CHECK");
    dot.classList.remove("off");
    if (text) text.textContent = "Connected";
  } catch (err) {
    dot.classList.add("off");
    if (text) text.textContent = "Offline";
    maybeShowKeyLimitModal(err); // additive: key usage-limit error modal
  }
}

// ── SEARCH TAB ────────────────────────────────────────────────────────────────

const searchInput   = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const searchHint    = document.getElementById("search-hint");
let _searchDebounce;

searchInput.addEventListener("input", () => {
  clearTimeout(_searchDebounce);
  const q = searchInput.value.trim();
  if (!q) {
    searchResults.innerHTML = "";
    if (searchHint) searchHint.style.display = "";
    return;
  }
  if (searchHint) searchHint.style.display = "none";
  searchResults.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  _searchDebounce = setTimeout(() => doSearch(q), 320);
});

searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    clearTimeout(_searchDebounce);
    const q = searchInput.value.trim();
    if (q) doSearch(q);
  }
});

async function doSearch(q) {
  searchResults.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  const ql = q.toLowerCase();

  // Run memory search + project filter in parallel
  const memPromise = sendMsg("SEARCH_MEMORY", { query: q, limit: 12 }).catch(() => ({ items: [] }));
  const projPromise = (
    _projLoaded
      ? Promise.resolve(_projects)
      : sendMsg("LIST_PROJECTS").then(d => { _projects = d.items || []; _projLoaded = true; return _projects; }).catch(() => [])
  ).then(projs => projs.filter(p =>
    (p.name||"").toLowerCase().includes(ql) || (p.description||"").toLowerCase().includes(ql)
  ));

  try {
    const [memData, matchedProjs] = await Promise.all([memPromise, projPromise]);
    const items = Array.isArray(memData) ? memData : (memData.results || memData.items || []);

    if (!items.length && !matchedProjs.length) {
      searchResults.innerHTML = `<div class="empty">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Nothing found</div>
        <div class="empty-sub">Try different keywords</div></div>`;
      return;
    }

    let html = "";

    // Projects section
    if (matchedProjs.length) {
      html += `<div style="padding:6px 2px 4px;font-size:9px;font-weight:800;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px">Projects</div>`;
      html += matchedProjs.map(p => `
        <div class="project-item ctx-search-proj" data-id="${esc(p.id)}" data-ctx="${esc(buildPopupProjContext(p))}" style="margin-bottom:6px">
          <div class="project-icon">${getProjectEmoji(p.name)}</div>
          <div style="flex:1;min-width:0">
            <div class="project-name">${esc(p.name)}</div>
            ${p.description ? `<div class="project-desc">${esc(p.description)}</div>` : ""}
          </div>
          <button class="inject-btn ctx-proj-inject-btn" title="Inject into AI chat">⚡ Use</button>
        </div>`).join("");
    }

    // Memories section
    if (items.length) {
      if (matchedProjs.length) {
        html += `<div style="padding:6px 2px 4px;font-size:9px;font-weight:800;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px">Memories</div>`;
      }
      html += items.map(d => renderDocItem(d)).join("");
    }

    searchResults.innerHTML = html;

    // Wire project clicks (open in web app) and inject buttons
    searchResults.querySelectorAll(".ctx-search-proj").forEach(el => {
      el.onclick = () => {
        getAppUrl(`/projects/${el.dataset.id}`).then(url => chrome.tabs.create({ url }));
      };
    });
    searchResults.querySelectorAll(".ctx-proj-inject-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const row = btn.closest(".ctx-search-proj");
        injectIntoPage(row ? row.dataset.ctx : "");
        btn.textContent = "✓";
        btn.style.background = "rgba(16,185,129,0.3)";
        btn.style.color = "#6EE7B7";
        setTimeout(() => { btn.textContent = "⚡ Use"; btn.style.background = ""; btn.style.color = ""; }, 1500);
      };
    });
  } catch (err) {
    searchResults.innerHTML = `<div class="status error">⚠ ${esc(friendlyError(err))}</div>`;
  }
}

function buildPopupProjContext(p) {
  const parts = ["Project: " + (p.name || "Unnamed")];
  if (p.description) parts.push(p.description);
  if (p.goals)       parts.push("Goals: " + p.goals);
  return parts.join("\n");
}

// ── MEMORIES TAB ──────────────────────────────────────────────────────────────

let _allMemories  = [];
let _memFilter    = "all";
let _memLoaded    = false;

document.querySelectorAll("#mem-filters .chip").forEach(c => {
  c.onclick = () => {
    document.querySelectorAll("#mem-filters .chip").forEach(x => x.classList.remove("active"));
    c.classList.add("active");
    _memFilter = c.dataset.filter;
    renderMemList();
  };
});

async function loadMemories(force = false) {
  if (_memLoaded && !force) { renderMemList(); return; }
  const list = document.getElementById("mem-list");
  list.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const data   = await sendMsg("LIST_MEMORY", { page: 1, perPage: 50 });
    _allMemories = Array.isArray(data) ? data : (data.items || []);
    _memLoaded   = true;
    renderMemList();
  } catch (err) {
    const friendly = friendlyError(err);
    list.innerHTML = err.message.includes("LIMIT_REACHED")
      ? renderUpgradeBanner()
      : `<div class="status error">⚠ ${esc(friendly)}</div>`;
  }
}

function renderMemList() {
  const list  = document.getElementById("mem-list");
  const items = _memFilter === "all"
    ? _allMemories
    : _allMemories.filter(d => d.doc_type === _memFilter);

  if (!items.length) {
    list.innerHTML = `<div class="empty">
      <div class="empty-icon">🧠</div>
      <div class="empty-title">No memories yet</div>
      <div class="empty-sub">Save notes, code, prompts, and more from the Save tab.</div></div>`;
    return;
  }
  list.innerHTML = items.map(d => renderDocItem(d, true)).join("");
  list.querySelectorAll(".item-del").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this memory?")) return;
      btn.textContent = "…";
      try {
        await sendMsg("DELETE_MEMORY", { id: btn.dataset.id });
        _allMemories = _allMemories.filter(d => d.id !== btn.dataset.id);
        renderMemList();
      } catch (err) {
        alert("Delete failed: " + friendlyError(err));
        btn.textContent = "✕";
      }
    };
  });
}

function renderDocItem(d, showDelete = false) {
  const typeClass = getBadgeClass(d.doc_type || "note");
  const tags = (d.tags || []).slice(0, 4)
    .map(t => `<span class="tag">${esc(t)}</span>`).join("");
  const delBtn = showDelete
    ? `<button class="item-del" data-id="${esc(d.id)}" title="Delete">✕</button>`
    : "";
  const preview = (d.content || "").replace(/\n/g, " ").slice(0, 120);
  return `
    <div class="item">
      ${delBtn}
      <div class="item-title">${esc(d.title || "Untitled")}</div>
      ${preview ? `<div class="item-preview">${esc(preview)}${(d.content||"").length > 120 ? "…" : ""}</div>` : ""}
      <div class="item-footer">
        <span class="badge ${typeClass}">${esc(d.doc_type || "note")}</span>
        ${tags}
      </div>
    </div>`;
}


// ── Plan usage display ────────────────────────────────────────────────────────

async function loadPlanUsage() {
  try {
    const plan = await sendMsg("GET_PLAN");
    const used  = plan?.usage?.memories ?? 0;
    const limit = plan?.limits?.memories ?? -1;
    const name  = plan?.display_name ?? "Free";

    // Update header status text
    const txt = document.getElementById("hdr-status-text");
    if (txt) {
      txt.textContent = limit > 0
        ? `${name} · ${used}/${limit} memories`
        : `${name} plan`;
    }

    // Show upgrade prompt in memories panel if at limit
    if (limit > 0 && used >= limit) {
      const banner = document.getElementById("mem-usage-bar");
      if (banner) {
        banner.innerHTML = `<div class="upgrade-banner" style="margin-bottom:8px">
          <div class="upgrade-title">🔒 ${used}/${limit} memories used</div>
          <div class="upgrade-sub">You've reached the ${name} limit. Upgrade for unlimited memories.</div>
          <button id="upgrade-btn-usage" class="btn-full btn-primary-grad" style="font-size:12px;padding:8px">⚡ Upgrade Plan</button>
        </div>`;
        document.getElementById("upgrade-btn-usage")?.addEventListener("click", () => {
          getAppUrl("/pricing").then(url => chrome.tabs.create({ url }));
        });
      }
    } else if (limit > 0) {
      const bar = document.getElementById("mem-usage-bar");
      if (bar) {
        const pct = Math.min(Math.round((used / limit) * 100), 100);
        bar.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--dim);margin-bottom:4px">
          <span>${used}/${limit} memories used</span><span>${name} plan</span></div>
          <div style="height:3px;border-radius:2px;background:var(--surface-hover)">
            <div style="height:3px;border-radius:2px;background:var(--accent);width:${pct}%"></div>
          </div>`;
      }
    }
  } catch (_) {
    // Non-critical
  }
}

function renderUpgradeBanner() {
  return `<div class="upgrade-banner">
    <div class="upgrade-title">🔒 Memory limit reached</div>
    <div class="upgrade-sub">Upgrade to save unlimited memories and continue building your second brain.</div>
    <button id="upgrade-btn" class="btn-full btn-primary-grad" style="font-size:12px;padding:9px">⚡ Upgrade Plan</button>
  </div>`;
}

document.getElementById("mem-list").addEventListener("click", (e) => {
  if (e.target.id === "upgrade-btn") {
    getAppUrl("/pricing").then(url => chrome.tabs.create({ url }));
  }
});

// ── PROJECTS TAB ──────────────────────────────────────────────────────────────

let _projects = [];
let _projLoaded = false;

async function loadProjects(force = false) {
  if (_projLoaded && !force) { renderProjects(); return; }
  const list = document.getElementById("project-list");
  list.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const data = await sendMsg("LIST_PROJECTS");
    _projects  = data.items || data || [];
    _projLoaded = true;
    renderProjects();
    // Also populate the project selector in Save tab
    populateProjSelector();
  } catch (err) {
    list.innerHTML = `<div class="status error">⚠ ${esc(friendlyError(err))}</div>`;
  }
}

function renderProjects() {
  const list = document.getElementById("project-list");
  if (!_projects.length) {
    list.innerHTML = `<div class="empty">
      <div class="empty-icon">📁</div>
      <div class="empty-title">No projects yet</div>
      <div class="empty-sub">Create a project to organise your work.</div></div>`;
    return;
  }
  list.innerHTML = _projects.map(p => `
    <div class="project-item" data-id="${esc(p.id)}">
      <div class="project-icon">${getProjectEmoji(p.name)}</div>
      <div style="flex:1;min-width:0">
        <div class="project-name">${esc(p.name)}</div>
        ${p.description ? `<div class="project-desc">${esc(p.description)}</div>` : ""}
      </div>
      <div class="project-meta">${formatDate(p.created_at)}</div>
    </div>`).join("");

  list.querySelectorAll(".project-item").forEach(el => {
    el.onclick = () => {
      getAppUrl(`/projects/${el.dataset.id}`).then(url => chrome.tabs.create({ url }));
    };
  });
}

function getProjectEmoji(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("web") || n.includes("site")) return "🌐";
  if (n.includes("app") || n.includes("mobile")) return "📱";
  if (n.includes("api") || n.includes("back")) return "⚙️";
  if (n.includes("design") || n.includes("ui")) return "🎨";
  if (n.includes("ai") || n.includes("ml")) return "🤖";
  if (n.includes("data") || n.includes("analytics")) return "📊";
  if (n.includes("doc") || n.includes("write")) return "📝";
  return "📁";
}

// New project form
document.getElementById("new-project-btn").onclick = () => {
  const form = document.getElementById("new-project-form");
  form.style.display = form.style.display === "none" ? "flex" : "none";
  if (form.style.display === "flex") document.getElementById("new-proj-name").focus();
};

document.getElementById("cancel-proj-btn").onclick = () => {
  document.getElementById("new-project-form").style.display = "none";
};

document.getElementById("create-proj-btn").onclick = async () => {
  const name = document.getElementById("new-proj-name").value.trim();
  const desc = document.getElementById("new-proj-desc").value.trim();
  const status = document.getElementById("new-proj-status");
  if (!name) { setStatus(status, "Project name required.", "error"); return; }
  const btn = document.getElementById("create-proj-btn");
  btn.disabled = true; btn.textContent = "Creating…";
  try {
    await sendMsg("CREATE_PROJECT", { name, description: desc });
    _projLoaded = false;
    await loadProjects(true);
    document.getElementById("new-project-form").style.display = "none";
    document.getElementById("new-proj-name").value = "";
    document.getElementById("new-proj-desc").value = "";
    setStatus(status, "", "");
  } catch (err) {
    setStatus(status, "✗ " + friendlyError(err), "error");
  } finally {
    btn.disabled = false; btn.textContent = "Create Project";
  }
};

// ── SAVE TAB ──────────────────────────────────────────────────────────────────

let _selectedType = "note";
let _tagsList = [];

function initSaveTab() {
  // Load projects for selector
  if (!_projLoaded) loadProjects();
  else populateProjSelector();

  // Populate from active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    if (!tab?.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;
    const bar = document.getElementById("page-bar");
    document.getElementById("page-bar-title").textContent = (tab.title || tab.url).slice(0, 60);
    try {
      document.getElementById("page-bar-host").textContent = new URL(tab.url).hostname;
    } catch (_) {}
    const favicon = document.getElementById("page-favicon");
    favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
      (() => { try { return new URL(tab.url).hostname; } catch (_) { return ""; } })()
    )}&sz=32`;
    favicon.onerror = () => { favicon.style.display = "none"; };
    bar.style.display = "flex";
    bar.onclick = () => {
      const titleEl = document.getElementById("save-title");
      const contentEl = document.getElementById("save-content");
      if (!titleEl.value) titleEl.value = tab.title || "";
      if (!contentEl.value) {
        contentEl.value = `Source: ${tab.url}`;
        contentEl.dispatchEvent(new Event("input"));
      }
      bar.style.opacity = "0.4";
      bar.style.pointerEvents = "none";
    };
  });
}

function populateProjSelector() {
  const sel = document.getElementById("proj-select");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— No project —</option>' +
    _projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
  if (current) sel.value = current;
}

// Type chip selection
document.querySelectorAll(".type-chip").forEach(chip => {
  chip.onclick = () => {
    document.querySelectorAll(".type-chip").forEach(c => { c.className = "type-chip"; });
    _selectedType = chip.dataset.type;
    chip.classList.add(`sel-${_selectedType}`);
  };
});

// Char counter
const saveContent = document.getElementById("save-content");
const charFill    = document.getElementById("char-fill");
const charCount   = document.getElementById("char-count");

saveContent.addEventListener("input", () => {
  const len = saveContent.value.length;
  const pct = Math.min(100, (len / 4000) * 100);
  charFill.style.width = `${pct}%`;
  charCount.textContent = `${len} / 4000`;
  charFill.style.background = len > 4000 ? "#EF4444" : len > 3500 ? "#F59E0B" : "#4f9437";
  charCount.className = "char-count" + (len > 4000 ? " over" : len > 3500 ? " warn" : "");
});

// Tags
const tagInput = document.getElementById("save-tags-input");
document.getElementById("tags-area").addEventListener("click", () => tagInput.focus());
tagInput.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const val = tagInput.value.trim().replace(/,$/,"");
    if (val && !_tagsList.includes(val)) { _tagsList.push(val); renderTagPills(); }
    tagInput.value = "";
  }
  if (e.key === "Backspace" && !tagInput.value && _tagsList.length) {
    _tagsList.pop(); renderTagPills();
  }
});

function renderTagPills() {
  const area = document.getElementById("tags-area");
  area.innerHTML = _tagsList.map((t, i) => `
    <span class="tag-pill">${esc(t)}<span class="tag-x" data-i="${i}">×</span></span>`
  ).join("");
  area.querySelectorAll(".tag-x").forEach(x => {
    x.onclick = () => { _tagsList.splice(+x.dataset.i, 1); renderTagPills(); };
  });
  // Re-add input (got wiped)
  const input = document.createElement("input");
  input.id = "save-tags-input";
  input.type = "text";
  input.placeholder = "Type a tag, press Enter…";
  input.style.cssText = "background:transparent;border:none;border-radius:0;color:var(--text);flex:1;font-size:12px;min-width:80px;outline:none;padding:2px 0";
  area.appendChild(input);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = input.value.trim().replace(/,$/,"");
      if (val && !_tagsList.includes(val)) { _tagsList.push(val); renderTagPills(); }
      input.value = "";
    }
    if (e.key === "Backspace" && !input.value && _tagsList.length) {
      _tagsList.pop(); renderTagPills();
    }
  });
  area.addEventListener("click", () => input.focus());
}

// Save button
document.getElementById("save-btn").onclick = async () => {
  const title   = document.getElementById("save-title").value.trim();
  const content = saveContent.value.trim();
  const projId  = document.getElementById("proj-select").value || null;
  const status  = document.getElementById("save-status");

  if (!title)   { setStatus(status, "Title is required.", "error"); return; }
  if (!content) { setStatus(status, "Content is required.", "error"); return; }

  const btn = document.getElementById("save-btn");
  btn.disabled = true; btn.textContent = "Saving…";
  setStatus(status, "", "");

  try {
    const result = await sendMsg("SAVE_MEMORY", {
      title, content,
      doc_type:   _selectedType,
      tags:       [..._tagsList],
      project_id: projId,
    });
    _memLoaded = false; // Invalidate cache
    showSaveSuccess(result?.title || title);
  } catch (err) {
    setStatus(status, "✗ " + friendlyError(err), "error");
  } finally {
    btn.disabled = false; btn.textContent = "💾 Save to ContextOS";
  }
};

function showSaveSuccess(title) {
  document.getElementById("save-form").style.display = "none";
  document.getElementById("suc-sub").textContent = `"${title}" is now in your second brain.`;
  document.getElementById("save-success").classList.add("show");
}

document.getElementById("save-another-btn").onclick = resetSaveForm;
document.getElementById("view-mem-btn").onclick = () => {
  resetSaveForm();
  switchTab("memories");
};

function resetSaveForm() {
  document.getElementById("save-title").value = "";
  saveContent.value = "";
  charFill.style.width = "0%";
  charCount.textContent = "0 / 4000";
  charCount.className = "char-count";
  _tagsList = [];
  renderTagPills();
  _selectedType = "note";
  document.querySelectorAll(".type-chip").forEach(c => { c.className = "type-chip"; });
  document.querySelector('.type-chip[data-type="note"]').classList.add("sel-note");
  document.getElementById("proj-select").value = "";
  const bar = document.getElementById("page-bar");
  bar.style.opacity = "";
  bar.style.pointerEvents = "";
  document.getElementById("save-form").style.display = "flex";
  document.getElementById("save-success").classList.remove("show");
  setStatus(document.getElementById("save-status"), "", "");
}

// ── SETTINGS TAB ──────────────────────────────────────────────────────────────

async function loadSettings() {
  const r = await new Promise(res =>
    chrome.storage.sync.get(["apiUrl","apiKey","autoInject"], res)
  );
  document.getElementById("api-url").value = r.apiUrl || "";
  document.getElementById("api-key").value = r.apiKey || "";
  document.getElementById("auto-inject").checked = r.autoInject !== false;
}

document.getElementById("save-settings-btn").onclick = async () => {
  const apiUrl     = document.getElementById("api-url").value.trim().replace(/\/$/,"");
  const apiKey     = document.getElementById("api-key").value.trim();
  const autoInject = document.getElementById("auto-inject").checked;
  const status     = document.getElementById("settings-status");
  await new Promise(r => chrome.storage.sync.set({ apiUrl, apiKey, autoInject }, r));
  setStatus(status, "✓ Settings saved!", "success");
  // Invalidate all caches
  _memLoaded = false; _projLoaded = false;
  refreshStatusDot();
  updateFooterLink(apiUrl);
};

document.getElementById("test-conn-btn").onclick = async () => {
  const status = document.getElementById("settings-status");
  setStatus(status, "Testing…");
  try {
    const health = await sendMsg("HEALTH_CHECK");
    setStatus(status, `✓ Connected — server v${health.version || "?"}`, "success");
    document.getElementById("hdr-dot").classList.remove("off");
    document.getElementById("hdr-status-text").textContent = "Connected";
  } catch (err) {
    setStatus(status, "✗ " + friendlyError(err), "error");
    document.getElementById("hdr-dot").classList.add("off");
    document.getElementById("hdr-status-text").textContent = "Offline";
  }
};

document.getElementById("open-app-btn").onclick = async () => {
  const url = await getAppUrl("/dashboard");
  chrome.tabs.create({ url });
};

document.getElementById("disconnect-btn").onclick = async () => {
  if (!confirm("Disconnect from ContextOS? Your data stays safe.")) return;
  // Clear key AND urls so the next connect flow sets them fresh
  await new Promise(r => chrome.storage.sync.remove(["apiKey", "apiUrl", "frontendUrl"], r));
  window.location.reload();
};

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function getAppUrl(path = "") {
  const r = await new Promise(res => chrome.storage.sync.get(["apiUrl", "frontendUrl"], res));
  // Prefer the stored frontendUrl (set during connect flow)
  if (r.frontendUrl) {
    try { return new URL(r.frontendUrl).origin + path; } catch (_) {}
  }
  // Legacy fallback: derive frontend URL from backend URL (only works when both are on localhost)
  try {
    const u = new URL(r.apiUrl || "https://contextos-production-d82a.up.railway.app");
    const port = u.port === "8000" ? "5173" : (u.port || "");
    return `${u.protocol}//${u.hostname}${port ? ":"+port : ""}${path}`;
  } catch (_) { return `https://contextos-eta.vercel.app${path}`; }
}

function updateFooterLink(apiUrl) {
  const link = document.getElementById("footer-app-link");
  if (!link) return;
  // getAppUrl is async; we fire-and-forget just to update the href
  getAppUrl("").then(url => { if (link) link.href = url; }).catch(() => {});
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
  } catch (_) { return ""; }
}

// ── SCREEN MANAGEMENT ─────────────────────────────────────────────────────────

function showScreen(name) {
  document.getElementById("screen-login").classList.toggle("show", name === "login");
  document.getElementById("screen-main").classList.toggle("show",  name === "main");
}

// ── CONNECT FLOW ──────────────────────────────────────────────────────────────

function initConnectFlow() {
  const btn    = document.getElementById("connect-btn");
  const status = document.getElementById("connect-status");

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "Opening…";
    status.textContent = "Complete the connection in the tab that opens.";

    const stored = await new Promise(r => chrome.storage.sync.get(["apiUrl", "frontendUrl"], r));
    let frontendBase = "https://contextos-eta.vercel.app";
    // Prefer stored frontendUrl; only derive from apiUrl when on localhost
    if (stored.frontendUrl) {
      try { frontendBase = new URL(stored.frontendUrl).origin; } catch (_) {}
    } else if (stored.apiUrl) {
      try {
        const u = new URL(stored.apiUrl);
        if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
          const port = u.port === "8000" ? "5173" : (u.port || "5173");
          frontendBase = `${u.protocol}//${u.hostname}:${port}`;
        }
        // Production API URL -> keep Vercel as frontendBase
      } catch (_) {}
    }

    // Reuse an already-open connect tab/window instead of opening a duplicate.
    // (The extension popup closes when the auth window takes focus, killing the
    // poll below — so a leftover window plus a second click used to create two.)
    let authWin = null;
    try {
      const existing = await chrome.tabs.query({ url: "*://*/connect-extension*" });
      if (existing.length) {
        const t = existing[0];
        try { await chrome.windows.update(t.windowId, { focused: true }); } catch (_) {}
        try { await chrome.tabs.update(t.id, { active: true }); } catch (_) {}
        authWin = { id: t.windowId, tabId: t.id };
        // Close any extra duplicates beyond the first
        for (const dup of existing.slice(1)) {
          try { await chrome.tabs.remove(dup.id); } catch (_) {}
        }
      }
    } catch (_) {}

    if (!authWin) {
      // Open the connect flow as ONE normal tab in the current window. The
      // extension popup closes automatically as the tab activates, so the
      // user sees a single surface (previously a detached popup window PLUS
      // the still-open extension popup read as two). background.js picks up
      // the key and closes this tab once connected.
      authWin = await chrome.tabs.create({ url: frontendBase + "/connect-extension", active: true });
    }

    // Close the extension popup now that the connect window is open — leaving
    // it up makes the flow look like two surfaces for one connection. The
    // background tabs.onUpdated watcher saves the key and closes the connect
    // window on success, so nothing below is required for the happy path;
    // the poll remains only as a fallback if window.close() is blocked.
    setTimeout(() => { try { window.close(); } catch (_) {} }, 150);

    let waited = 0;
    const poll = setInterval(async () => {
      waited++;
      const r = await new Promise(res => chrome.storage.sync.get(["apiKey"], res));
      if (r.apiKey) {
        clearInterval(poll);
        // Close the auth window
        try {
          if (authWin.id) await chrome.windows.remove(authWin.id);
        } catch (_) {
          try { if (authWin.id) await chrome.tabs.remove(authWin.id); } catch (__) {}
        }
        window.location.reload();
      } else if (waited > 180) {
        clearInterval(poll);
        btn.disabled = false;
        btn.textContent = "Connect with ContextOS →";
        status.textContent = "Timed out — try again.";
        status.style.color = "#f87171";
      }
    }, 1000);
  };
}

// ── User info ────────────────────────────────────────────────────────────────

async function loadUserInfo() {
  try {
    const user = await sendMsg("GET_USER_INFO");
    const sub = document.getElementById("hdr-sub");
    if (sub && (user.name || user.email)) {
      sub.textContent = user.name || user.email;
    }
  } catch (_) {
    // Non-critical — header sub text stays as "Second Brain"
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────

async function init() {
  // Show version
  try {
    const v = chrome.runtime.getManifest().version;
    const el = document.getElementById("ext-version");
    if (el) el.textContent = v;
  } catch (_) {}

  const { apiUrl, apiKey } = await new Promise(r =>
    chrome.storage.sync.get(["apiUrl","apiKey"], r)
  );

  if (!apiKey) {
    showScreen("login");
    initConnectFlow();
    return;
  }

  showScreen("main");
  updateFooterLink(apiUrl);

  // Load initial data
  refreshStatusDot();
  loadUserInfo();  // show user name in header
  loadMemories();  // pre-load memories so tab is instant
  loadPlanUsage(); // show plan usage in header + memories tab
  initAccountChip(); // account bar: email · plan · team (additive)

  // Make footer app link work
  document.getElementById("footer-app-link").onclick = async (e) => {
    e.preventDefault();
    const url = await getAppUrl("/dashboard");
    chrome.tabs.create({ url });
  };
}

init();

// ── Account chip (additive) — connected email · plan · team indicator ────────
// Slim bar under the header. Reuses GET_USER_INFO / GET_PLAN / TEAM_INFO and
// the existing disconnect flow for logout — no new auth logic, no secrets
// displayed (email + plan name only).
async function initAccountChip() {
  const bar = document.getElementById("acc-bar");
  if (!bar) return;

  let user;
  try { user = await sendMsg("GET_USER_INFO"); } catch (_) { return; }
  const email = user && user.email;
  if (!email) return;

  document.getElementById("acc-email").textContent = email;
  document.getElementById("acc-menu-email").textContent = email;
  const initial = ((user.name || email).trim()[0] || "?").toUpperCase();
  document.getElementById("acc-avatar").textContent = initial;
  bar.classList.add("show");

  // Plan badge — best-effort, non-blocking
  sendMsg("GET_PLAN").then((plan) => {
    const raw = plan?.display_name || "Free";
    const label = /plan/i.test(raw) ? raw : raw + " Plan";
    const badge = document.getElementById("acc-plan-badge");
    badge.textContent = label;
    badge.style.display = "";
    document.getElementById("acc-menu-plan").textContent = label;
  }).catch(() => {});

  // Team workspace indicator — only for active team members
  sendMsg("TEAM_INFO").then((t) => {
    if (!t?.hasTeam) return;
    document.getElementById("acc-team-dot").style.display = "";
    const line = document.getElementById("acc-menu-team");
    line.textContent = "👥 " + (t.team?.name ? `${t.team.name} · team workspace` : "Team workspace access");
    line.style.display = "";
  }).catch(() => {});

  // Dropdown open/close
  const chip = document.getElementById("acc-chip");
  const menu = document.getElementById("acc-menu");
  chip.onclick = (e) => { e.stopPropagation(); menu.classList.toggle("show"); };
  document.addEventListener("click", (e) => {
    if (menu.classList.contains("show") && !bar.contains(e.target)) {
      menu.classList.remove("show");
    }
  });

  // Actions — all reuse existing helpers/flows
  document.getElementById("acc-view-account").onclick = async () => {
    chrome.tabs.create({ url: await getAppUrl("/profile") });
  };
  document.getElementById("acc-plan-details").onclick = async () => {
    chrome.tabs.create({ url: await getAppUrl("/pricing") });
  };
  document.getElementById("acc-logout").onclick = () => {
    menu.classList.remove("show");
    // Same confirm + storage-clear flow as the Settings "Disconnect" button.
    document.getElementById("disconnect-btn").click();
  };
}

// ── API key limit modal (additive) ────────────────────────────────────────────
// Shown when the extension can't connect because the API key's usage limit is
// reached (LIMIT_REACHED / HTTP 429 from the backend). Premium error state —
// not a system failure. "Delete API Key" clears the stored key (the connect
// flow then issues a fresh one automatically); "Upgrade Plan" and "Manage API
// Keys" open the web app via the existing getAppUrl helper.
let _klShown = false;

function maybeShowKeyLimitModal(err) {
  try {
    const m = (err && err.message) || "";
    if (!/LIMIT_REACHED|API_ERROR 429/i.test(m)) return;
    showKeyLimitModal();
  } catch (_) {}
}

function showKeyLimitModal() {
  const ov = document.getElementById("keylimit-overlay");
  if (!ov || _klShown) return;
  _klShown = true;
  ov.classList.add("show");

  const hide = () => { ov.classList.remove("show"); _klShown = false; };
  document.getElementById("kl-close").onclick = hide;
  ov.onclick = (e) => { if (e.target === ov) hide(); };

  document.getElementById("kl-upgrade").onclick = async () => {
    chrome.tabs.create({ url: await getAppUrl("/pricing") });
  };
  document.getElementById("kl-manage").onclick = async () => {
    chrome.tabs.create({ url: await getAppUrl("/api-keys") });
  };

  document.getElementById("kl-delete").onclick = async () => {
    const btn = document.getElementById("kl-delete");
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="kl-spin"></span>Removing API Key…';
    // Brief pause so the loading state is visible, then clear the stored key.
    await new Promise((r) => setTimeout(r, 700));
    // apiUrl/frontendUrl are kept so reconnecting is one click — the connect
    // flow (STORE_CLERK_TOKEN) issues a fresh API key automatically.
    await new Promise((r) => chrome.storage.sync.remove(["apiKey"], r));
    window.location.reload(); // popup re-inits → connect screen
  };
}
