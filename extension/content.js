// ContextOS Extension — Content Script
// Injected into all supported AI platforms

// ── Platform detection ────────────────────────────────────────────────────────

const MAX_CHARS = 6000; // max content chars saved per memory

const PLATFORMS = {
  "claude.ai": {
    name: "Claude",
    inputSelectors: ['[data-testid="chat-input"]', 'div[contenteditable="true"]', ".ProseMirror"],
    chatSelectors: ['[data-testid="chat-messages"]', ".conversation-content", "main"],
    color: "#D97706",
  },
  "chatgpt.com": {
    name: "ChatGPT",
    inputSelectors: ["#prompt-textarea", 'textarea[data-id="root"]', "textarea"],
    chatSelectors: ['[data-testid="conversation-turn"]', ".flex.flex-col.items-center", "main"],
    color: "#10A37F",
  },
  "chat.openai.com": {
    name: "ChatGPT",
    inputSelectors: ["#prompt-textarea", "textarea"],
    chatSelectors: ["main"],
    color: "#10A37F",
  },
  "gemini.google.com": {
    name: "Gemini",
    inputSelectors: [".ql-editor", '.gemini-input [contenteditable="true"]', 'div[contenteditable="true"][aria-label]', 'div[contenteditable="true"]'],
    chatSelectors: [".conversation-container", "main"],
    color: "#1A73E8",
  },
  "perplexity.ai": {
    name: "Perplexity",
    inputSelectors: ["textarea", 'div[contenteditable="true"]'],
    chatSelectors: ["main"],
    color: "#6366F1",
  },
  "copilot.microsoft.com": {
    name: "Copilot",
    inputSelectors: ["textarea", 'div[contenteditable="true"]'],
    chatSelectors: ["main", "cib-chat-main"],
    color: "#0078D4",
  },
  "chat.mistral.ai": {
    name: "Mistral",
    inputSelectors: ["textarea", 'div[contenteditable="true"]'],
    chatSelectors: ["main"],
    color: "#FF7000",
  },
  "grok.com": {
    name: "Grok",
    inputSelectors: ["textarea", 'div[contenteditable="true"]'],
    chatSelectors: ["main"],
    color: "#6366F1",
  },
  "x.com": {
    name: "Grok (X)",
    inputSelectors: ["textarea"],
    chatSelectors: ["main"],
    color: "#6366F1",
  },
  "vscode.dev": {
    name: "VS Code Copilot",
    inputSelectors: [".chat-input-part textarea", ".interactive-input-editor textarea", 'div[contenteditable="true"][data-mprt]', "textarea.inputarea", "textarea"],
    chatSelectors: [".chat-messages-list", ".interactive-list", ".chat-widget", "main"],
    color: "#007ACC",
  },
  "github.dev": {
    name: "GitHub Dev",
    inputSelectors: [".chat-input-part textarea", ".interactive-input-editor textarea", "textarea.inputarea", "textarea"],
    chatSelectors: [".chat-messages-list", ".interactive-list", "main"],
    color: "#007ACC",
  },
  "github.com": {
    name: "GitHub Copilot",
    inputSelectors: ["#copilot-chat-textarea", 'textarea[name="message"]', 'div[contenteditable="true"]', "textarea"],
    chatSelectors: ["#copilot-chat-panel", ".copilot-chat-messages", "main"],
    color: "#24292E",
  },
  "lovable.dev": {
    name: "Lovable",
    inputSelectors: ['textarea[placeholder]', "textarea", 'div[contenteditable="true"]'],
    chatSelectors: [".chat-messages", ".message-list", "main"],
    color: "#FF6B35",
  },
  "replit.com": {
    name: "Replit AI",
    inputSelectors: ["textarea", 'div[contenteditable="true"]'],
    chatSelectors: [".ai-pane", ".thread-container", ".message-list", "main"],
    color: "#F26207",
  },
  "bolt.new": {
    name: "Bolt",
    inputSelectors: ["textarea", 'div[contenteditable="true"]'],
    chatSelectors: [".messages", ".chat-list", "main"],
    color: "#6366F1",
  },
  "stackblitz.com": {
    name: "StackBlitz AI",
    inputSelectors: ["textarea", 'div[contenteditable="true"]'],
    chatSelectors: [".messages", "main"],
    color: "#1389FD",
  },
  "chat.qwenlm.ai": {
    name: "Qwen",
    inputSelectors: ["textarea", 'div[contenteditable="true"]'],
    chatSelectors: ["main"],
    color: "#6B21A8",
  },
  "chat.deepseek.com": {
    name: "DeepSeek",
    inputSelectors: ["textarea", 'div[contenteditable="true"]'],
    chatSelectors: ["main"],
    color: "#4D6BFE",
  },
};

function getPlatform() {
  const hostname = window.location.hostname.replace("www.", "");

  // Avoid injecting on all GitHub / X pages — only Copilot / Grok chat surfaces
  if (hostname === "github.com") {
    const onCopilot =
      /copilot/i.test(location.pathname + location.search) ||
      !!document.querySelector("#copilot-chat-textarea, #copilot-chat-panel, .copilot-chat-messages");
    if (!onCopilot) return null;
  }
  if (hostname === "x.com") {
    const onGrok =
      /grok/i.test(location.pathname) ||
      !!document.querySelector('textarea[data-testid="grok-query"], [aria-label*="Grok"]');
    if (!onGrok) return null;
  }

  return (
    PLATFORMS[hostname] ||
    Object.entries(PLATFORMS).find(([key]) => hostname.includes(key))?.[1] ||
    null
  );
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function findElement(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function getPageText() {
  const platform = getPlatform();
  if (!platform) return document.body.innerText.slice(0, 8000);
  const chatEl = findElement(platform.chatSelectors);
  if (chatEl) return chatEl.innerText.slice(0, 8000);
  return document.body.innerText.slice(0, 8000);
}

function injectIntoInput(text) {
  const platform = getPlatform();
  if (!platform) return false;
  const input = findElement(platform.inputSelectors);
  if (!input) return false;

  const prefix = "[ContextOS Memory]\n" + text + "\n\n---\n\n";

  if (input.tagName === "TEXTAREA") {
    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeSet) {
      nativeSet.call(input, prefix + input.value);
    } else {
      input.value = prefix + input.value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (input.getAttribute("contenteditable")) {
    input.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(input, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    const lines = prefix.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 0) document.execCommand("insertText", false, lines[i]);
      if (i < lines.length - 1) document.execCommand("insertParagraph", false);
    }
  }
  return true;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Extension context guard ───────────────────────────────────────────────────

let _contextInvalidated = false;

function onContextInvalidated() {
  if (_contextInvalidated) return;
  _contextInvalidated = true;
  ["ctx-fab", "ctx-sidebar", "ctx-suggestion", "ctx-picker", "ctx-dialog"].forEach(
    (id) => document.getElementById(id)?.remove()
  );
  if (document.getElementById("ctx-refresh-banner")) return;
  const banner = document.createElement("div");
  banner.id = "ctx-refresh-banner";
  banner.style.cssText = [
    "position:fixed", "bottom:16px", "right:16px", "z-index:2147483647",
    "background:#1a1a2e", "border:1px solid rgba(255,255,255,0.15)",
    "border-radius:10px", "padding:10px 16px",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "font-size:13px", "color:rgba(255,255,255,0.85)",
    "display:flex", "align-items:center", "gap:10px",
    "box-shadow:0 4px 20px rgba(0,0,0,0.5)", "cursor:pointer",
  ].join(";");
  banner.innerHTML =
    "<span>🧠</span>" +
    "<span>ContextOS updated — <strong>refresh this page</strong> to reconnect.</span>" +
    "<span id='ctx-banner-close' style='margin-left:4px;opacity:0.5;font-size:16px;line-height:1'>x</span>";
  banner.onclick = () => location.reload();
  banner.querySelector("#ctx-banner-close").onclick = (e) => { e.stopPropagation(); banner.remove(); };
  document.body?.appendChild(banner);
}

// ── Service-worker keep-alive (only while suggestions are active) ─────────────

var _keepAliveActive = false;
var _keepAlivePort = null;
var _keepAliveTimer = null;

function startKeepWorkerAlive() {
  if (_keepAliveActive || _contextInvalidated) return;
  _keepAliveActive = true;
  _connectKeepAlivePort();
}

function stopKeepWorkerAlive() {
  _keepAliveActive = false;
  clearTimeout(_keepAliveTimer);
  _keepAliveTimer = null;
  if (_keepAlivePort) {
    try { _keepAlivePort.disconnect(); } catch (_) {}
    _keepAlivePort = null;
  }
}

function _connectKeepAlivePort() {
  if (!_keepAliveActive || _contextInvalidated) return;
  try {
    _keepAlivePort = chrome.runtime.connect({ name: "keepAlive" });
    _keepAlivePort.onDisconnect.addListener(() => {
      _keepAlivePort = null;
      if (_contextInvalidated || !_keepAliveActive) return;
      const errMsg = chrome.runtime.lastError?.message || "";
      if (errMsg.includes("context invalidated")) { onContextInvalidated(); return; }
      _keepAliveTimer = setTimeout(_connectKeepAlivePort, 5000);
    });
    // Refresh port every 45s — enough to keep MV3 worker warm without churn
    _keepAliveTimer = setTimeout(() => {
      if (!_keepAliveActive || _contextInvalidated) return;
      if (_keepAlivePort) {
        try { _keepAlivePort.disconnect(); } catch (_) {}
        _keepAlivePort = null;
      }
      _connectKeepAlivePort();
    }, 45000);
  } catch (e) {
    if ((e?.message || "").includes("context invalidated")) {
      onContextInvalidated();
    } else if (_keepAliveActive) {
      _keepAliveTimer = setTimeout(_connectKeepAlivePort, 5000);
    }
  }
}

// ── sendMessage ───────────────────────────────────────────────────────────────

function sendMessage(type, data, attempt) {
  data = data || {};
  attempt = attempt || 0;
  var RETRY_DELAYS = [300, 1000];
  return new Promise(function(resolve, reject) {
    if (_contextInvalidated) {
      reject(new Error("ContextOS disconnected — please refresh this page."));
      return;
    }
    try {
      chrome.runtime.sendMessage(Object.assign({ type: type }, data), function(res) {
        var err = chrome.runtime.lastError;
        if (err) {
          var msg = err.message || "";
          if (msg.includes("context invalidated")) {
            onContextInvalidated();
            reject(new Error("ContextOS disconnected — please refresh this page."));
            return;
          }
          var isTransient = msg.includes("Receiving end does not exist") || msg.includes("Could not establish connection");
          if (isTransient && attempt < RETRY_DELAYS.length) {
            setTimeout(function() {
              sendMessage(type, data, attempt + 1).then(resolve).catch(reject);
            }, RETRY_DELAYS[attempt]);
          } else {
            reject(new Error(msg));
          }
          return;
        }
        if (!res || !res.ok) {
          reject(new Error(res && res.error ? res.error : "Unknown error from background"));
        } else {
          resolve(res.data);
        }
      });
    } catch (e) {
      var msg = e && e.message ? e.message : "";
      if (msg.includes("context invalidated")) {
        onContextInvalidated();
        reject(new Error("ContextOS disconnected — please refresh this page."));
      } else if (attempt < RETRY_DELAYS.length) {
        setTimeout(function() {
          sendMessage(type, data, attempt + 1).then(resolve).catch(reject);
        }, RETRY_DELAYS[attempt]);
      } else {
        reject(e);
      }
    }
  });
}

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles(accentColor) {
  if (document.getElementById("ctx-styles")) return;
  var style = document.createElement("style");
  style.id = "ctx-styles";
  style.textContent = [
    "#ctx-fab{position:fixed;bottom:20px;right:20px;z-index:2147483646;width:44px;height:44px;min-width:0!important;padding:0!important;margin:0!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:transparent!important;border:none!important;box-shadow:none!important;outline:none!important;display:block!important}",
    "#ctx-fab-btn{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366F1,#8B5CF6);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 20px rgba(99,102,241,0.5);transition:transform .15s,box-shadow .15s}",
    "#ctx-fab-btn:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(99,102,241,0.65)}",
    "#ctx-fab-menu{display:none;flex-direction:column;position:absolute;bottom:56px;right:0;white-space:nowrap;background:#1e1e2e;border:1px solid rgba(255,255,255,0.12);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:200px}",
    "#ctx-fab-menu.open{display:flex}",
    ".ctx-fab-action{display:flex;align-items:center;gap:10px;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.07);border-radius:0;padding:11px 16px;cursor:pointer;font-size:12px;font-weight:600;color:#fff;white-space:nowrap;width:100%;text-align:left;transition:background .12s}",
    ".ctx-fab-action:last-child{border-bottom:none}",
    ".ctx-fab-action:hover{background:rgba(255,255,255,0.07)}",
    ".ctx-sidebar{position:fixed;top:0;right:-340px;width:320px;height:100vh;background:#1e1e2e;border-left:1px solid rgba(255,255,255,0.1);z-index:2147483645;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:right .25s ease;box-shadow:-8px 0 32px rgba(0,0,0,0.4)}",
    ".ctx-sidebar.ctx-sidebar-open{right:0}",
    ".ctx-sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;font-size:13px;font-weight:700;color:#fff}",
    ".ctx-sidebar-close{background:none;border:none;color:rgba(255,255,255,0.45);cursor:pointer;font-size:16px;line-height:1;padding:0}",
    ".ctx-sidebar-close:hover{color:#fff}",
    ".ctx-sidebar-search{display:flex;gap:6px;padding:0 12px 12px}",
    ".ctx-sidebar-search input{flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-family:inherit;font-size:12px;outline:none;padding:7px 10px}",
    ".ctx-sidebar-search input::placeholder{color:rgba(255,255,255,0.3)}",
    ".ctx-sidebar-search button{border:none;border-radius:8px;color:#fff;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;padding:7px 12px}",
    ".ctx-results{flex:1;overflow-y:auto;padding:0 12px 12px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.1) transparent}",
    ".ctx-memory-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:9px;padding:10px 11px}",
    ".ctx-memory-title{font-size:12px;font-weight:700;color:#fff;margin-bottom:4px}",
    ".ctx-memory-preview{font-size:11px;color:rgba(255,255,255,0.45);line-height:1.5;margin-bottom:6px}",
    ".ctx-memory-actions{display:flex;gap:6px}",
    ".ctx-inject-btn{background:#6366F1;border:none;border-radius:6px;color:#fff;cursor:pointer;font-family:inherit;font-size:10px;font-weight:700;padding:4px 10px;transition:opacity .15s}",
    ".ctx-inject-btn:hover{opacity:0.85}",
    ".ctx-loading,.ctx-empty,.ctx-error{font-size:12px;color:rgba(255,255,255,0.35);text-align:center;padding:24px 0}",
    ".ctx-error{color:#F87171}",
    ".ctx-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2147483644}",
    ".ctx-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483645;background:#1e1e2e;border:1px solid rgba(255,255,255,0.12);border-radius:14px;width:420px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
    ".ctx-modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;font-size:13px;font-weight:700;color:#fff;border-bottom:1px solid rgba(255,255,255,0.08)}",
    ".ctx-close-btn{background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:16px;line-height:1;padding:0}",
    ".ctx-modal-body{padding:14px 16px;display:flex;flex-direction:column;gap:8px}",
    ".ctx-modal-body label{font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:2px;display:block}",
    ".ctx-modal-body input,.ctx-modal-body textarea{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-family:inherit;font-size:12px;outline:none;padding:8px 10px;width:100%;box-sizing:border-box}",
    ".ctx-modal-body textarea{resize:vertical}",
    ".ctx-status{font-size:12px;min-height:18px}",
    ".ctx-modal-footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.08)}",
    ".ctx-btn-cancel{background:rgba(255,255,255,0.07);border:none;border-radius:8px;color:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;padding:8px 16px}",
    ".ctx-btn-save{border:none;border-radius:8px;color:#fff;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:8px 18px}",
    "@keyframes ctxSlideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes ctxSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
  ].join("\n");
  document.head.appendChild(style);
}

// ── FAB ───────────────────────────────────────────────────────────────────────

var _currentPlatform = null;
function injectFAB(platform) {
  _currentPlatform = platform;
  if (document.getElementById("ctx-fab")) return;
  var accentColor = (platform && platform.color) ? platform.color : "#6366F1";
  injectStyles(accentColor);

  var fab = document.createElement("div");
  fab.id = "ctx-fab";
  fab.innerHTML =
    '<div id="ctx-fab-menu">' +
      '<button class="ctx-fab-action" id="ctx-save-btn">💾 Save memory</button>' +
      '<button class="ctx-fab-action" id="ctx-sidebar-btn">🧠 My memories</button>' +
      '<button class="ctx-fab-action" id="ctx-suggest-toggle-btn" title="">⚡ Auto-suggestions: OFF</button>' +
    '</div>' +
    '<button id="ctx-fab-btn" title="ContextOS — drag to move">🧠</button>';
  document.body.appendChild(fab);

  var menuOpen = false;
  var fabBtn  = document.getElementById("ctx-fab-btn");
  var fabMenu = document.getElementById("ctx-fab-menu");

  // ── Drag to reposition ──────────────────────────────────────────────────────
  var dragging = false;
  var dragMoved = false;
  var dragStartX, dragStartY, fabStartRight, fabStartBottom;

  var _fabRaf = 0;
  var _fabPendingPos = null;
  var _fabSaveTimer = null;

  function onFabMouseMove(e) {
    var dx = dragStartX - e.clientX;
    var dy = dragStartY - e.clientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    _fabPendingPos = {
      right:  Math.max(0, Math.min(window.innerWidth  - 48, fabStartRight  + dx)),
      bottom: Math.max(0, Math.min(window.innerHeight - 48, fabStartBottom + dy)),
    };
    if (_fabRaf) return;
    _fabRaf = requestAnimationFrame(function() {
      _fabRaf = 0;
      if (!_fabPendingPos) return;
      fab.style.right  = _fabPendingPos.right  + "px";
      fab.style.bottom = _fabPendingPos.bottom + "px";
    });
  }

  function onFabMouseUp() {
    dragging = false;
    fab.style.transition = "";
    document.removeEventListener("mousemove", onFabMouseMove);
    document.removeEventListener("mouseup",   onFabMouseUp);
    if (_fabRaf) { cancelAnimationFrame(_fabRaf); _fabRaf = 0; }
    // Debounce position persistence — avoid storage writes every drag frame
    clearTimeout(_fabSaveTimer);
    _fabSaveTimer = setTimeout(function() {
      try {
        chrome.storage.sync.set({ fabRight: fab.style.right, fabBottom: fab.style.bottom });
      } catch (_) {}
    }, 400);
  }

  fabBtn.addEventListener("mousedown", function(e) {
    if (e.button !== 0) return;
    dragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    var rect = fab.getBoundingClientRect();
    fabStartRight  = window.innerWidth  - rect.right;
    fabStartBottom = window.innerHeight - rect.bottom;
    fab.style.transition = "none";
    // Add listeners only while dragging — removed immediately in onFabMouseUp
    document.addEventListener("mousemove", onFabMouseMove, { passive: true });
    document.addEventListener("mouseup",   onFabMouseUp,   { passive: true });
    e.preventDefault();
  });

  // Restore saved position
  try {
    chrome.storage.sync.get(["fabRight", "fabBottom"], function(r) {
      if (r.fabRight)  fab.style.right  = r.fabRight;
      if (r.fabBottom) fab.style.bottom = r.fabBottom;
    });
  } catch(_) {}

  // ── Click (only when not dragged) ──────────────────────────────────────────
  function closeFabMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    fabMenu.classList.remove("open");
    document.removeEventListener("click", closeFabMenu);
  }

  fabBtn.onclick = function(e) {
    if (dragMoved) { dragMoved = false; return; }
    e.stopPropagation();
    menuOpen = !menuOpen;
    fabMenu.classList.toggle("open", menuOpen);
    if (menuOpen) {
      setTimeout(function() { document.addEventListener("click", closeFabMenu); }, 0);
    } else {
      document.removeEventListener("click", closeFabMenu);
    }
  };
  document.getElementById("ctx-save-btn").onclick = function(e) {
    e.stopPropagation();
    menuOpen = false;
    fabMenu.classList.remove("open");
    showSaveDialog(getPageText());
  };
  document.getElementById("ctx-sidebar-btn").onclick = function(e) {
    e.stopPropagation();
    menuOpen = false;
    fabMenu.classList.remove("open");
    toggleSidebar();
  };

  // ── Auto-suggestion toggle ─────────────────────────────────────────────────
  var _toggleBtn = document.getElementById("ctx-suggest-toggle-btn");

  function _updateToggleBtn(enabled) {
    if (!_toggleBtn) return;
    if (enabled) {
      _toggleBtn.textContent = "⚡ Auto-suggestions: ON";
      _toggleBtn.style.borderColor = "#6366F1";
      _toggleBtn.style.color = "#a5b4fc";
      _toggleBtn.title = "ON — ContextOS watches your typing and shows related memories automatically. Turn off if AI feels slow.";
    } else {
      _toggleBtn.textContent = "⚡ Auto-suggestions: OFF";
      _toggleBtn.style.borderColor = "";
      _toggleBtn.style.color = "";
      _toggleBtn.title = "OFF — No background watching. Zero lag. Turn on to get automatic memory suggestions while you type.";
    }
  }

  // Read saved preference on load
  try {
    chrome.storage.sync.get(["suggestEnabled"], function(r) {
      // Default OFF unless user explicitly turned it on
      _suggestEnabled = r.suggestEnabled === true;
      _autoSuggestOn = _suggestEnabled;
      _updateToggleBtn(_suggestEnabled);
    });
  } catch(_) {}

  _toggleBtn.onclick = function(e) {
    e.stopPropagation();
    menuOpen = false;
    fabMenu.classList.remove("open");
    _suggestEnabled = !_suggestEnabled;
    _autoSuggestOn = _suggestEnabled;
    _updateToggleBtn(_suggestEnabled);

    // Persist choice
    try { chrome.storage.sync.set({ suggestEnabled: _suggestEnabled }); } catch(_) {}

    // Show brief confirmation toast
    var confirmPill = document.createElement("div");
    confirmPill.style.cssText = [
      "position:fixed","bottom:80px","right:20px","z-index:2147483647",
      "background:#1a1a2e","border:1px solid rgba(99,102,241,0.4)",
      "border-left:3px solid #6366F1","border-radius:20px",
      "padding:7px 14px","font-size:11px","font-weight:600",
      "color:#a5b4fc","pointer-events:none",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "animation:ctxSlideIn 0.18s ease",
    ].join(";");
    confirmPill.textContent = _suggestEnabled
      ? "⚡ Auto-suggestions ON — memories will appear as you type"
      : "🔇 Auto-suggestions OFF — zero background activity";
    document.body.appendChild(confirmPill);
    setTimeout(function() { confirmPill.remove(); }, 2800);

    // Start or stop the watcher + keep-alive
    if (_suggestEnabled) {
      startKeepWorkerAlive();
      watchInputForSuggestions(_currentPlatform);
    } else {
      stopInputWatcher();
      stopKeepWorkerAlive();
      hideSearchingIndicator();
      document.getElementById("ctx-suggestion-toast")?.remove();
    }
  };
}

// ── Limit error helper ───────────────────────────────────────────────────────

function isLimitError(err) {
  var m = (err && err.message) ? err.message : "";
  return m.includes("LIMIT_REACHED") || m.includes("402") || m.includes("limit");
}

function getWebAppUrl(path) {
  return new Promise(function(resolve) {
    chrome.storage.sync.get(["apiUrl"], function(r) {
      try {
        var u    = new URL(r.apiUrl || "http://localhost:8000");
        var port = u.port === "8000" ? "5173" : u.port;
        resolve(u.protocol + "//" + u.hostname + (port ? ":" + port : "") + path);
      } catch(_) {
        resolve("http://localhost:5173" + path);
      }
    });
  });
}

function showLimitError(statusEl) {
  statusEl.innerHTML =
    '<div style="color:#F87171;font-size:12px;font-weight:700;margin-bottom:8px">Memory limit reached</div>' +
    '<button id="ctx-upgrade-btn" style="' +
      'display:inline-flex;align-items:center;gap:6px;' +
      'background:linear-gradient(135deg,#6366F1,#8B5CF6);' +
      'border:none;border-radius:9px;color:#fff;cursor:pointer;' +
      'font-size:12px;font-weight:700;padding:9px 20px;' +
      'box-shadow:0 4px 14px rgba(99,102,241,0.45)' +
    '">⚡ Upgrade to Pro</button>';
  getWebAppUrl("/pricing").then(function(url) {
    var btn = document.getElementById("ctx-upgrade-btn");
    if (btn) btn.onclick = function() { window.open(url, "_blank"); };
  });
}

// ── Save dialog ───────────────────────────────────────────────────────────────

var TYPE_OPTIONS = [
  { value: "note",      emoji: "📝", label: "Note" },
  { value: "code",      emoji: "💻", label: "Code" },
  { value: "reference", emoji: "🔗", label: "Reference" },
  { value: "idea",      emoji: "💡", label: "Idea" },
];

function showSaveDialog(defaultContent) {
  document.getElementById("ctx-dialog")?.remove();
  var platform    = getPlatform();
  var accentColor = (platform && platform.color) ? platform.color : "#6366F1";
  var platformName = (platform && platform.name) ? platform.name : "AI";

  // State
  var selectedType = "note";
  var tags = [];
  var tagInput = "";

  var capturedTitle = document.title || (platformName + " — " + new Date().toLocaleDateString());
  var capturedUrl   = window.location.href;
  var capturedContent = defaultContent ? defaultContent.slice(0, MAX_CHARS) : "";

  // Extra styles for the rich dialog (idempotent)
  if (!document.getElementById("ctx-dialog-styles")) {
    var ds = document.createElement("style");
    ds.id = "ctx-dialog-styles";
    ds.textContent = [
      ".ctx-page-capture{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:8px;padding:8px 10px;margin-bottom:2px}",
      ".ctx-page-favicon{width:16px;height:16px;border-radius:3px;flex-shrink:0}",
      ".ctx-page-info{flex:1;min-width:0}",
      ".ctx-page-title{font-size:11px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".ctx-page-url{font-size:10px;color:rgba(255,255,255,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".ctx-type-chips{display:flex;gap:6px;flex-wrap:wrap}",
      ".ctx-type-chip{border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:5px 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.55);cursor:pointer;background:transparent;transition:all .15s;white-space:nowrap}",
      ".ctx-type-chip.active{color:#fff;border-color:transparent}",
      ".ctx-char-bar-wrap{height:2px;background:rgba(255,255,255,0.07);border-radius:2px;margin-top:4px}",
      ".ctx-char-bar{height:2px;border-radius:2px;transition:width .2s,background .2s}",
      ".ctx-char-count{font-size:10px;color:rgba(255,255,255,0.3);text-align:right;margin-top:3px}",
      ".ctx-tag-area{display:flex;flex-wrap:wrap;gap:5px;align-items:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 8px;min-height:34px;cursor:text}",
      ".ctx-tag-pill{display:flex;align-items:center;gap:4px;background:rgba(99,102,241,0.25);border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:2px 8px;font-size:11px;color:#a5b4fc}",
      ".ctx-tag-pill span{cursor:pointer;opacity:0.6;font-size:13px;line-height:1}",
      ".ctx-tag-pill span:hover{opacity:1}",
      ".ctx-tag-input{background:transparent;border:none;outline:none;color:#fff;font-size:12px;font-family:inherit;min-width:80px;flex:1}",
      ".ctx-tag-input::placeholder{color:rgba(255,255,255,0.25)}",
      "@keyframes ctxSuccessPop{0%{transform:scale(0.7);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}",
      ".ctx-success{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;text-align:center;gap:10px}",
      ".ctx-success-icon{font-size:44px;animation:ctxSuccessPop 0.4s ease forwards}",
      ".ctx-success-title{font-size:15px;font-weight:700;color:#fff}",
      ".ctx-success-sub{font-size:12px;color:rgba(255,255,255,0.45)}",
    ].join("\n");
    document.head.appendChild(ds);
  }

  var dialog = document.createElement("div");
  dialog.id = "ctx-dialog";
  document.body.appendChild(dialog);

  function getFaviconUrl() {
    var link = document.querySelector("link[rel*=\'icon\']");
    return link ? link.href : ("https://www.google.com/s2/favicons?domain=" + window.location.hostname + "&sz=32");
  }

  function getChipColor(type) {
    var map = { note: "#6366F1", code: "#10B981", reference: "#F59E0B", idea: "#EC4899" };
    return map[type] || accentColor;
  }

  function renderTagPills() {
    var area = dialog.querySelector("#ctx-tag-area");
    if (!area) return;
    // Remove old pills (keep input)
    area.querySelectorAll(".ctx-tag-pill").forEach(function(p) { p.remove(); });
    var input = area.querySelector(".ctx-tag-input");
    tags.forEach(function(tag, i) {
      var pill = document.createElement("span");
      pill.className = "ctx-tag-pill";
      pill.innerHTML = escapeHtml(tag) + '<span data-i="' + i + '">×</span>';
      pill.querySelector("span").onclick = function() {
        tags.splice(i, 1);
        renderTagPills();
      };
      area.insertBefore(pill, input);
    });
  }


  function renderChips() {
    dialog.querySelectorAll(".ctx-type-chip").forEach(function(chip) {
      var t = chip.dataset.type;
      chip.classList.toggle("active", t === selectedType);
      chip.style.background = t === selectedType ? getChipColor(t) : "";
    });
  }

  function render() {
    dialog.innerHTML =
      '<div class="ctx-backdrop"></div>' +
      '<div class="ctx-modal" style="width:440px">' +
        '<div class="ctx-modal-header" style="border-left:3px solid ' + accentColor + '">' +
          '💾 Save to ContextOS' +
          '<button class="ctx-close-btn" id="ctx-dlg-close">×</button>' +
        '</div>' +
        '<div class="ctx-modal-body" style="gap:10px">' +

          // Page capture bar
          '<div class="ctx-page-capture">' +
            '<img class="ctx-page-favicon" src="' + escapeHtml(getFaviconUrl()) + '" onerror="this.style.display=\'none\'" />' +
            '<div class="ctx-page-info">' +
              '<div class="ctx-page-title">' + escapeHtml(capturedTitle.slice(0, 80)) + '</div>' +
              '<div class="ctx-page-url">' + escapeHtml(capturedUrl.slice(0, 80)) + '</div>' +
            '</div>' +
          '</div>' +

          // Title
          '<div>' +
            '<label>Title</label>' +
            '<input id="ctx-title" type="text" placeholder="Memory title…" value="' + escapeHtml(capturedTitle.slice(0, 120)) + '" />' +
          '</div>' +

          // Type chips
          '<div>' +
            '<label>Type</label>' +
            '<div class="ctx-type-chips">' +
              TYPE_OPTIONS.map(function(t) {
                return '<button class="ctx-type-chip' + (t.value === selectedType ? ' active' : '') + '" data-type="' + t.value + '" style="' + (t.value === selectedType ? 'background:' + getChipColor(t.value) + ';border-color:transparent' : '') + '">' + t.emoji + ' ' + t.label + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +

          // Content + char counter
          '<div>' +
            '<label>Content</label>' +
            '<textarea id="ctx-content" rows="6" style="resize:vertical">' + escapeHtml(capturedContent) + '</textarea>' +
          '</div>' +

          // Tags
          '<div>' +
            '<label>Tags</label>' +
            '<div class="ctx-tag-area" id="ctx-tag-area">' +
              '<input class="ctx-tag-input" id="ctx-tag-input" placeholder="Add tag…" />' +
            '</div>' +
          '</div>' +

          '<div class="ctx-status" id="ctx-status"></div>' +
        '</div>' +
        '<div class="ctx-modal-footer">' +
          '<button class="ctx-btn-cancel" id="ctx-dlg-cancel">Cancel</button>' +
          '<button class="ctx-btn-save" id="ctx-dlg-save" style="background:' + accentColor + '">Save Memory</button>' +
        '</div>' +
      '</div>';

    // Wire events
    var close = function() { dialog.remove(); };
    dialog.querySelector(".ctx-backdrop").onclick = close;
    dialog.querySelector("#ctx-dlg-close").onclick = close;
    dialog.querySelector("#ctx-dlg-cancel").onclick = close;

    // Type chips
    dialog.querySelectorAll(".ctx-type-chip").forEach(function(chip) {
      chip.onclick = function() {
        selectedType = chip.dataset.type;
        renderChips();
      };
    });

    // Char bar
    var textarea = dialog.querySelector("#ctx-content");

    // Tag input
    var tagArea  = dialog.querySelector("#ctx-tag-area");
    var tagInp   = dialog.querySelector("#ctx-tag-input");
    tagArea.onclick = function() { tagInp.focus(); };
    tagInp.onkeydown = function(e) {
      if ((e.key === "Enter" || e.key === ",") && tagInp.value.trim()) {
        e.preventDefault();
        var t = tagInp.value.replace(/,/g, "").trim();
        if (t && !tags.includes(t)) { tags.push(t); renderTagPills(); }
        tagInp.value = "";
      } else if (e.key === "Backspace" && !tagInp.value && tags.length) {
        tags.pop();
        renderTagPills();
      }
    };
    renderTagPills();

    // Save
    dialog.querySelector("#ctx-dlg-save").onclick = async function() {
      var title   = dialog.querySelector("#ctx-title").value.trim();
      var content = dialog.querySelector("#ctx-content").value.trim();
      var status  = dialog.querySelector("#ctx-status");

      if (!title || !content) {
        status.textContent = "Title and content are required.";
        status.style.color = "#EF4444";
        return;
      }
      status.textContent = "Saving…";
      status.style.color = "#6B7280";

      try {
        await sendMessage("SAVE_MEMORY", {
          title:   title,
          content: content,
          doc_type: selectedType,
          tags:    tags,
        });
        _lastSuggestedQuery = "";
        // Show success screen
        var modalBody = dialog.querySelector(".ctx-modal");
        modalBody.innerHTML =
          '<div class="ctx-success">' +
            '<div class="ctx-success-icon">🎉</div>' +
            '<div class="ctx-success-title">Saved!</div>' +
            '<div class="ctx-success-sub">' + escapeHtml(title) + '</div>' +
          '</div>';
        if (document.getElementById("ctx-sidebar")?.classList.contains("ctx-sidebar-open")) {
          loadMemories("");
        }
        setTimeout(function() { dialog.remove(); }, 1800);
      } catch (err) {
        if (isLimitError(err)) {
          showLimitError(status);
        } else {
          status.textContent = err.message;
          status.style.color = "#EF4444";
        }
      }
    };
  }

  render();
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function toggleSidebar() {
  var existing = document.getElementById("ctx-sidebar");
  if (existing) { existing.classList.toggle("ctx-sidebar-open"); return; }

  var platform    = getPlatform();
  var accentColor = (platform && platform.color) ? platform.color : "#6366F1";

  var sidebar = document.createElement("div");
  sidebar.id = "ctx-sidebar";
  sidebar.className = "ctx-sidebar ctx-sidebar-open";
  sidebar.innerHTML =
    '<div class="ctx-sidebar-header" style="border-bottom:2px solid ' + accentColor + '">' +
      '<span>🧠 ContextOS Memory</span>' +
      '<button class="ctx-sidebar-close">x</button>' +
    '</div>' +
    '<div class="ctx-sidebar-search">' +
      '<input id="ctx-search-input" type="text" placeholder="Search memories..." />' +
      '<button id="ctx-search-btn" style="background:' + accentColor + '">Search</button>' +
    '</div>' +
    '<div id="ctx-results" class="ctx-results"><div class="ctx-loading">Loading...</div></div>';

  document.body.appendChild(sidebar);
  sidebar.querySelector(".ctx-sidebar-close").onclick = function() {
    sidebar.classList.remove("ctx-sidebar-open");
  };

  loadMemories("");

  var searchInput = document.getElementById("ctx-search-input");
  var debounceTimer;
  searchInput.oninput = function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() { loadMemories(searchInput.value); }, 400);
  };
  document.getElementById("ctx-search-btn").onclick = function() { loadMemories(searchInput.value); };
  searchInput.onkeydown = function(e) { if (e.key === "Enter") loadMemories(searchInput.value); };
}

async function loadMemories(query) {
  var results = document.getElementById("ctx-results");
  if (!results) return;
  results.innerHTML = '<div class="ctx-loading">Searching...</div>';
  try {
    var data;
    if (query && query.trim()) {
      data = await sendMessage("SEARCH_MEMORY", { query: query, limit: 8 });
      renderMemories(Array.isArray(data) ? data : (data.results || []), results);
    } else {
      data = await sendMessage("LIST_MEMORY");
      renderMemories(data.items, results);
    }
  } catch (err) {
    results.innerHTML = '<div class="ctx-error">' + escapeHtml(err.message) + '</div>';
  }
}

function renderMemories(items, container) {
  if (!items || !items.length) {
    container.innerHTML = '<div class="ctx-empty">No memories found.</div>';
    return;
  }
  container.innerHTML = items.map(function(doc) {
    var preview = (doc.content || "").slice(0, 120);
    var hasMore = (doc.content || "").length > 120;
    return (
      '<div class="ctx-memory-card" data-content="' + escapeHtml(doc.content || "") + '">' +
        '<div class="ctx-memory-title">' + escapeHtml(doc.title || "Untitled") + '</div>' +
        '<div class="ctx-memory-preview">' + escapeHtml(preview) + (hasMore ? "…" : "") + '</div>' +
        '<div class="ctx-memory-actions"><button class="ctx-inject-btn">Use in chat</button></div>' +
      '</div>'
    );
  }).join("");

  container.querySelectorAll(".ctx-inject-btn").forEach(function(btn) {
    btn.onclick = function() {
      var card = btn.closest(".ctx-memory-card");
      var text = card ? card.dataset.content : "";
      injectIntoInput(text);
      btn.textContent = "Injected!";
      btn.style.background = "#10B981";
      setTimeout(function() { btn.textContent = "Use in chat"; btn.style.background = ""; }, 1500);
    };
  });
}

// ── Suggestion toast ──────────────────────────────────────────────────────────

var _lastSuggestedQuery = "";
var _suggestionDebounce = null;
var _suggestionTimeout  = null;
var _suggestEnabled = false;
var _autoSuggestOn = false;
var _searchAbortId = 0;

// ── Input watcher singleton (prevents duplicate intervals / listeners) ───────

var _inputWatcher = { active: false, cleanup: null };

function stopInputWatcher() {
  if (_inputWatcher.cleanup) {
    _inputWatcher.cleanup();
    _inputWatcher.cleanup = null;
  }
  _inputWatcher.active = false;
  clearTimeout(_suggestionDebounce);
  _suggestionDebounce = null;
  _searchAbortId++;
}

function watchInputForSuggestions(platform) {
  if (!_autoSuggestOn) return;
  attachInputWatcher(platform);
}

var _cachedInput = null;
var _cacheTs = 0;
function findInputWithShadow(platform) {
  // Return cached result if recent (< 5s) to avoid repeated DOM traversal
  var now = Date.now();
  if (_cachedInput && (now - _cacheTs) < 5000) {
    if (document.contains(_cachedInput)) return _cachedInput;
    _cachedInput = null;
  }

  // 1. Platform-specific selectors (cheapest)
  for (var i = 0; i < platform.inputSelectors.length; i++) {
    var el = document.querySelector(platform.inputSelectors[i]);
    if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" ||
               el.getAttribute("contenteditable"))) {
      _cachedInput = el; _cacheTs = now;
      return el;
    }
  }

  // 2. Gemini: pierce rich-textarea shadow DOM
  var rt = document.querySelector("rich-textarea");
  if (rt && rt.shadowRoot) {
    var inner = rt.shadowRoot.querySelector("[contenteditable]") ||
                rt.shadowRoot.querySelector(".ql-editor") ||
                rt.shadowRoot.querySelector("textarea");
    if (inner) { _cachedInput = inner; _cacheTs = now; return inner; }
  }

  return null;
}

function findInputFallback(platform) {
  var now = Date.now();
  var candidates = document.querySelectorAll("[contenteditable='true']");
  for (var j = 0; j < candidates.length; j++) {
    var c = candidates[j];
    if (c.offsetWidth > 100 && c.offsetHeight > 20) {
      _cachedInput = c; _cacheTs = now; return c;
    }
  }
  var textareas = document.querySelectorAll("textarea");
  for (var k = 0; k < textareas.length; k++) {
    var ta = textareas[k];
    if (ta.offsetWidth > 100 && ta.offsetHeight > 20) {
      _cachedInput = ta; _cacheTs = now; return ta;
    }
  }
  return null;
}

function attachInputWatcher(platform) {
  if (_inputWatcher.active) return;
  if (!_autoSuggestOn) return;
  _inputWatcher.active = true;

  var accentColor = (platform && platform.color) ? platform.color : "#6366F1";
  var watched = new WeakSet();
  var observers = [];
  var attachTimer = null;
  var navTimer = null;
  var attachAttempts = 0;

  function buildTypingHandler(input) {
    return function() {
      if (!_autoSuggestOn) return;
      clearTimeout(_suggestionDebounce);
      _suggestionDebounce = setTimeout(async function() {
        if (!_autoSuggestOn) return;
        var text = "";
        if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
          text = input.value || "";
        } else {
          text = input.innerText || input.textContent || "";
        }
        text = text.trim();
        if (text.length < 8) return;
        showSearchingIndicator(accentColor);

        var STOP = new Set(["what","this","that","with","have","from","they","will","been","were","when","your","more","also","some","than","then","which","about","into","their","there","would","could","should","these","those","other","after","before","first","over","under","just","like","make","only","know","take","where","does","dont","how","why","can","the","and","for","are","but","not","you","all","any","its","use","was","had","has","her","him","his","she","may","our","out","who","did","get","let","new","now","per","put","see","set","two","way","yet"]);
        var lastSentence = text.split(/[.!?\n]/).filter(Boolean).pop() || text;
        var words = lastSentence.split(/\s+/).filter(function(w) {
          return w.length >= 3 && !STOP.has(w.toLowerCase().replace(/[^a-z]/g,""));
        });

        var query;
        if (words.length >= 1) {
          query = words.slice(-5).join(" ");
        } else {
          var raw = text.split(/\s+/).filter(Boolean);
          if (raw.length < 3) return;
          query = raw.slice(-4).join(" ");
        }
        if (query === _lastSuggestedQuery) { hideSearchingIndicator(); return; }
        _lastSuggestedQuery = query;

        var abortId = ++_searchAbortId;
        try {
          var data = await sendMessage("SEARCH_MEMORY", { query: query, limit: 3 });
          if (abortId !== _searchAbortId || !_autoSuggestOn) return;
          var results = Array.isArray(data) ? data : (data.results || []);
          hideSearchingIndicator();
          if (results.length > 0) showSuggestionToast(results, accentColor);
        } catch (e) {
          if (abortId === _searchAbortId) hideSearchingIndicator();
        }
      }, 1800);
    };
  }

  function bindInput(input) {
    if (!input || watched.has(input)) return false;
    watched.add(input);

    var onType = buildTypingHandler(input);
    input.addEventListener("input", onType);
    input.addEventListener("compositionend", onType);

    if (input.getAttribute && input.getAttribute("contenteditable")) {
      var mo = new MutationObserver(function() {
        if (!_autoSuggestOn) return;
        onType();
      });
      var moActive = false;

      function startMo() {
        if (!moActive && _autoSuggestOn) {
          mo.observe(input, { characterData: true, childList: true, subtree: true });
          moActive = true;
        }
      }
      function stopMo() {
        if (moActive) {
          mo.disconnect();
          moActive = false;
        }
      }

      input.addEventListener("focus", startMo);
      input.addEventListener("blur", stopMo);
      observers.push({ mo: mo, stop: stopMo });

      if (document.activeElement === input || input.contains(document.activeElement)) {
        startMo();
      }
    }
    return true;
  }

  function tryAttach() {
    if (!_autoSuggestOn) return;
    var input = findInputWithShadow(platform) || findInputFallback(platform);
    if (input) bindInput(input);
  }

  tryAttach();

  // Aggressive poll only until first attach (max ~30s), then single light SPA check
  attachTimer = setInterval(function() {
    if (!_autoSuggestOn) return;
    attachAttempts++;
    tryAttach();
    if (attachAttempts >= 10) {
      clearInterval(attachTimer);
      attachTimer = null;
    }
  }, 3000);

  navTimer = setInterval(function() {
    if (!_autoSuggestOn) return;
    _cachedInput = null;
    tryAttach();
  }, 20000);

  _inputWatcher.cleanup = function() {
    clearInterval(attachTimer);
    clearInterval(navTimer);
    observers.forEach(function(o) { o.stop(); });
    observers.length = 0;
  };
}

// ── Search-in-progress indicator ─────────────────────────────────────────────
// Shows a tiny pill near the FAB immediately when user stops typing,
// so they know the extension is active — not silent/broken.
var _searchingIndicatorTimeout = null;

function showSearchingIndicator(accentColor) {
  var existing = document.getElementById("ctx-searching-pill");
  if (existing) return; // already visible
  var pill = document.createElement("div");
  pill.id = "ctx-searching-pill";
  pill.style.cssText = [
    "position:fixed", "bottom:80px", "right:20px", "z-index:2147483640",
    "background:#1a1a2e", "border:1px solid " + (accentColor || "#6366F1") + "44",
    "border-left:3px solid " + (accentColor || "#6366F1"),
    "border-radius:20px", "padding:6px 12px",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "font-size:11px", "color:rgba(255,255,255,0.55)",
    "display:flex", "align-items:center", "gap:6px",
    "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
    "animation:ctxSlideIn 0.18s ease",
    "pointer-events:none",
  ].join(";");
  pill.innerHTML = '<span style="display:inline-block;animation:ctxSpin 1s linear infinite;font-size:12px">⟳</span> Searching memories…';
  document.body.appendChild(pill);
  // Auto-remove after 4s as a safety net (results or no-results will remove it first)
  clearTimeout(_searchingIndicatorTimeout);
  _searchingIndicatorTimeout = setTimeout(hideSearchingIndicator, 4000);
}

function hideSearchingIndicator() {
  clearTimeout(_searchingIndicatorTimeout);
  var pill = document.getElementById("ctx-searching-pill");
  if (pill) pill.remove();
}

function showSuggestionToast(memories, accentColor) {
  document.getElementById("ctx-suggestion-toast")?.remove();

  var shown = memories.slice(0, 2); // show up to 2
  var count = memories.length;
  var label = count === 1 ? "1 related memory" : count + " related memories found";

  var toast = document.createElement("div");
  toast.id = "ctx-suggestion-toast";
  toast.style.cssText = [
    "position:fixed", "bottom:80px", "right:20px", "z-index:2147483640",
    "background:#1a1a2e", "border:1px solid " + accentColor + "44",
    "border-left:3px solid " + accentColor,
    "border-radius:12px", "padding:10px 12px", "width:290px",
    "box-shadow:0 12px 40px rgba(0,0,0,0.55)",
    "animation:ctxSlideIn 0.22s ease",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  ].join(";");

  // Header
  var header =
    '<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">' +
      '<span style="font-size:13px">🧠</span>' +
      '<span style="font-size:11px;font-weight:700;color:#a5b4fc;flex:1">' + escapeHtml(label) + '</span>' +
      '<button id="ctx-toast-close" style="background:none;border:none;color:rgba(255,255,255,0.35);cursor:pointer;font-size:16px;line-height:1;padding:0">×</button>' +
    '</div>';

  // Memory rows
  var rows = shown.map(function(mem, idx) {
    var title   = (mem.title || "Untitled").slice(0, 48);
    var preview = (mem.content || "").slice(0, 70);
    if ((mem.content || "").length > 70) preview += "…";
    return (
      '<div style="' +
        'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);' +
        'border-radius:8px;padding:8px 10px;' +
        (idx < shown.length - 1 ? 'margin-bottom:6px;' : '') +
      '">' +
        '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:11px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(title) + '</div>' +
            '<div style="font-size:10px;color:rgba(255,255,255,0.38);line-height:1.4;margin-top:2px">' + escapeHtml(preview) + '</div>' +
          '</div>' +
        '</div>' +
        '<button class="ctx-inject-memory-btn" data-idx="' + idx + '" style="' +
          'width:100%;background:' + accentColor + ';border:none;border-radius:6px;' +
          'color:#fff;font-size:10px;font-weight:700;padding:5px 8px;cursor:pointer;' +
          'text-align:center' +
        '">⚡ Inject this memory</button>' +
      '</div>'
    );
  }).join("");

  // View all link
  var footer =
    '<div style="text-align:center;margin-top:8px">' +
      '<button id="ctx-toast-view" style="background:none;border:none;color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;cursor:pointer;padding:0">View all memories →</button>' +
    '</div>';

  toast.innerHTML = header + rows + footer;
  document.body.appendChild(toast);

  clearTimeout(_suggestionTimeout);
  _suggestionTimeout = setTimeout(function() { toast.remove(); }, 8000);

  document.getElementById("ctx-toast-close").onclick = function(e) { e.stopPropagation(); toast.remove(); };
  document.getElementById("ctx-toast-view").onclick  = function(e) { e.stopPropagation(); toggleSidebar(); toast.remove(); };

  toast.querySelectorAll(".ctx-inject-memory-btn").forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      var idx = parseInt(btn.dataset.idx);
      injectIntoInput(shown[idx].content || "");
      btn.textContent = "✓ Injected!";
      btn.style.background = "#10B981";
      setTimeout(function() { toast.remove(); }, 1200);
    };
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function bootExtension(platform) {
  injectFAB(platform);
  if (_autoSuggestOn) {
    startKeepWorkerAlive();
    watchInputForSuggestions(platform);
  }
}

function init() {
  var platform = getPlatform();
  if (!platform) return;

  try {
    chrome.storage.sync.get(["suggestEnabled", "fabRight", "fabBottom"], function(r) {
      _suggestEnabled = r.suggestEnabled === true;
      _autoSuggestOn = _suggestEnabled;

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function() { bootExtension(platform); });
      } else {
        bootExtension(platform);
      }
    });

    chrome.storage.onChanged.addListener(function(changes, area) {
      if (area !== "sync" || !changes.suggestEnabled) return;
      _suggestEnabled = changes.suggestEnabled.newValue === true;
      _autoSuggestOn = _suggestEnabled;
      var toggleBtn = document.getElementById("ctx-suggest-toggle-btn");
      if (toggleBtn) {
        if (_suggestEnabled) {
          toggleBtn.textContent = "⚡ Auto-suggestions: ON";
          toggleBtn.style.borderColor = "#6366F1";
          toggleBtn.style.color = "#a5b4fc";
        } else {
          toggleBtn.textContent = "⚡ Auto-suggestions: OFF";
          toggleBtn.style.borderColor = "";
          toggleBtn.style.color = "";
        }
      }
      if (_suggestEnabled) {
        startKeepWorkerAlive();
        watchInputForSuggestions(platform);
      } else {
        stopInputWatcher();
        stopKeepWorkerAlive();
        hideSearchingIndicator();
        document.getElementById("ctx-suggestion-toast")?.remove();
      }
    });
  } catch (_) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function() { injectFAB(platform); });
    } else {
      injectFAB(platform);
    }
  }
}

init();
