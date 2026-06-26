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
    color: "#4f9437",
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
    color: "#4f9437",
  },
  "x.com": {
    name: "Grok (X)",
    inputSelectors: ["textarea"],
    chatSelectors: ["main"],
    color: "#4f9437",
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
    color: "#4f9437",
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

// Generic fallback so the panel can work on ANY website. It has no AI input
// selectors, so AI-only features (input injection, suggestions) stay disabled;
// only the save/search panel works. Marked generic so we can keep it lazy.
const GENERIC_PLATFORM = { name: "Web", inputSelectors: [], chatSelectors: ["main", "article"], color: "#4f9437", generic: true };

function getPlatform() {
  const hostname = window.location.hostname.replace("www.", "");

  // Avoid injecting on all GitHub / X pages — only Copilot / Grok chat surfaces
  if (hostname === "github.com") {
    const onCopilot =
      /copilot/i.test(location.pathname + location.search) ||
      !!document.querySelector("#copilot-chat-textarea, #copilot-chat-panel, .copilot-chat-messages");
    if (!onCopilot) return GENERIC_PLATFORM;
  }
  if (hostname === "x.com") {
    const onGrok =
      /grok/i.test(location.pathname) ||
      !!document.querySelector('textarea[data-testid="grok-query"], [aria-label*="Grok"]');
    if (!onGrok) return GENERIC_PLATFORM;
  }

  return (
    PLATFORMS[hostname] ||
    Object.entries(PLATFORMS).find(([key]) => hostname.includes(key))?.[1] ||
    GENERIC_PLATFORM
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

  const prefix = "[ContextOS — Second Brain]\n" + text + "\n\n---\n\n";

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
    "background:#eef3e7", "border:1px solid rgba(45, 70, 35, 0.32)",
    "border-radius:10px", "padding:10px 16px",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "font-size:13px", "color:rgba(45, 70, 35,0.85)",
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

function injectStyles() {
  if (document.getElementById("ctx-styles")) return;
  var style = document.createElement("style");
  style.id = "ctx-styles";
  style.textContent = [
    // ── FAB container
    "#ctx-fab{position:fixed;bottom:20px;right:20px;z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:block!important;background:none!important;border:none!important;box-shadow:none!important;padding:0!important;margin:0!important}",

    // ── Brain button
    "#ctx-fab-btn{width:34px;height:34px;border-radius:11px;background:#ffffff;border:1.5px solid rgba(79, 148, 55,0.5);cursor:grab;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(79, 148, 55,0.30);transition:transform .18s,box-shadow .18s;position:relative;user-select:none;line-height:1;padding:0}",
    "#ctx-fab-btn::after{content:'';position:absolute;inset:-4px;border-radius:15px;background:linear-gradient(145deg,#4f9437,#5fa83f);opacity:0.22;animation:ctxPulse 2.4s ease-in-out infinite;pointer-events:none}",
    "#ctx-fab-btn:hover{transform:scale(1.1);box-shadow:0 8px 32px rgba(79, 148, 55,0.7),0 0 0 0 rgba(115, 177, 79,0)}",
    "#ctx-fab-btn:active{cursor:grabbing;transform:scale(0.96)}",

    // ── Panel
    "#ctx-panel{position:absolute;right:0;width:330px;background:#f7faf2;border:1px solid rgba(45, 70, 35, 0.32);border-radius:20px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.7),0 0 0 1px rgba(79, 148, 55,0.15),inset 0 1px 0 rgba(45, 70, 35,0.06);display:none;flex-direction:column;max-height:500px}",
    "#ctx-panel.ctx-open{display:flex;animation:ctxPanelIn 0.22s cubic-bezier(0.34,1.56,0.64,1)}",

    // ── Panel header
    ".ctx-ph{display:flex;align-items:center;gap:8px;padding:13px 14px 11px;background:linear-gradient(180deg,rgba(79, 148, 55,0.12) 0%,transparent 100%);border-bottom:1px solid rgba(45, 70, 35, 0.32);flex-shrink:0}",
    ".ctx-ph-icon{font-size:18px;line-height:1}",
    ".ctx-ph-title{font-size:13px;font-weight:800;color:#1c2e1d;letter-spacing:-0.2px;flex:1}",
    ".ctx-ph-platform{font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;color:#1c2e1d;flex-shrink:0}",
    ".ctx-ph-dot{width:7px;height:7px;border-radius:50%;background:#10B981;flex-shrink:0;box-shadow:0 0 6px #10B981}",
    ".ctx-ph-dot.off{background:#6B7280;box-shadow:none}",
    ".ctx-ph-close{background:none;border:none;color:rgba(45, 70, 35,0.35);cursor:pointer;font-size:18px;line-height:1;padding:0 2px;transition:color .15s;flex-shrink:0}",
    ".ctx-ph-close:hover{color:#1c2e1d}",

    // ── Tabs
    ".ctx-tabs{display:flex;gap:2px;padding:8px 10px 0;border-bottom:1px solid rgba(45, 70, 35, 0.32);flex-shrink:0;background:#f7faf2}",
    ".ctx-tab{flex:1;background:transparent;border:none;color:rgba(45, 70, 35,0.4);cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;padding:7px 4px;border-radius:8px 8px 0 0;transition:all .15s;text-transform:uppercase;letter-spacing:0.4px}",
    ".ctx-tab:hover{color:rgba(45, 70, 35,0.75);background:rgba(45, 70, 35,0.04)}",
    ".ctx-tab.ctx-active{color:#2f6b34;background:rgba(79, 148, 55,0.12);border-bottom:2px solid #4f9437}",

    // ── Tab content
    ".ctx-tc{display:none;flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(45, 70, 35,0.08) transparent}",
    ".ctx-tc.ctx-active{display:flex;flex-direction:column}",

    // ── Memory & project list items
    ".ctx-item{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(45, 70, 35, 0.32);transition:background .12s;cursor:default}",
    ".ctx-item:last-child{border-bottom:none}",
    ".ctx-item:hover{background:rgba(45, 70, 35,0.03)}",
    ".ctx-item-icon{font-size:15px;line-height:1;margin-top:1px;flex-shrink:0}",
    ".ctx-item-body{flex:1;min-width:0}",
    ".ctx-item-title{font-size:12px;font-weight:700;color:#1c2e1d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}",
    ".ctx-item-sub{font-size:10px;color:rgba(45, 70, 35,0.38);line-height:1.4;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".ctx-item-ts{font-size:9px;color:rgba(45, 70, 35,0.22);margin-top:3px}",
    ".ctx-item-badge{font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(79, 148, 55,0.2);color:#2f6b34;text-transform:uppercase;letter-spacing:0.3px;flex-shrink:0}",
    ".ctx-inject-btn{background:rgba(79, 148, 55,0.15);border:1px solid rgba(79, 148, 55,0.3);border-radius:7px;color:#2f6b34;cursor:pointer;font-family:inherit;font-size:10px;font-weight:700;padding:4px 9px;transition:all .15s;flex-shrink:0;white-space:nowrap}",
    ".ctx-inject-btn:hover{background:#4f9437;border-color:#4f9437;color:#fff}",

    // ── Project items
    ".ctx-proj-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(45, 70, 35, 0.32);cursor:pointer;transition:background .12s}",
    ".ctx-proj-item:last-child{border-bottom:none}",
    ".ctx-proj-item:hover{background:rgba(45, 70, 35,0.04)}",
    ".ctx-proj-emoji{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,rgba(79, 148, 55,0.2),rgba(115, 177, 79,0.2));display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}",
    ".ctx-proj-info{flex:1;min-width:0}",
    ".ctx-proj-name{font-size:12px;font-weight:700;color:#1c2e1d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".ctx-proj-desc{font-size:10px;color:rgba(45, 70, 35,0.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}",
    ".ctx-proj-arrow{color:rgba(45, 70, 35,0.2);font-size:14px;flex-shrink:0;transition:color .15s}",
    ".ctx-proj-item:hover .ctx-proj-arrow{color:rgba(45, 70, 35,0.6)}",

    // ── Search tab
    ".ctx-search-wrap{padding:10px 12px;border-bottom:1px solid rgba(45, 70, 35, 0.32);flex-shrink:0}",
    ".ctx-search-wrap input{width:100%;background:rgba(45, 70, 35,0.06);border:1px solid rgba(45, 70, 35, 0.32);border-radius:10px;color:#1c2e1d;font-family:inherit;font-size:12px;outline:none;padding:8px 12px;box-sizing:border-box;transition:border-color .15s}",
    ".ctx-search-wrap input:focus{border-color:rgba(79, 148, 55,0.5)}",
    ".ctx-search-wrap input::placeholder{color:rgba(45, 70, 35,0.25)}",

    // ── Empty / loading / error states
    ".ctx-state{padding:28px 14px;text-align:center;color:rgba(45, 70, 35,0.3);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:6px}",
    ".ctx-state-icon{font-size:28px;opacity:0.5}",
    ".ctx-error-state{color:#F87171}",

    // ── Footer
    ".ctx-pf{display:flex;gap:7px;padding:10px 12px;border-top:1px solid rgba(45, 70, 35, 0.32);background:#f7faf2;flex-shrink:0}",
    ".ctx-pf-save{flex:1;background:linear-gradient(135deg,#4f9437,#5fa83f);border:none;border-radius:10px;color:#fff;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:9px 12px;transition:opacity .15s;text-align:center}",
    ".ctx-pf-save:hover{opacity:0.88}",
    ".ctx-pf-more{background:rgba(45, 70, 35,0.07);border:1px solid rgba(45, 70, 35, 0.32);border-radius:10px;color:rgba(45, 70, 35,0.55);cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;padding:9px 12px;transition:all .15s;white-space:nowrap}",
    ".ctx-pf-more:hover{background:rgba(45, 70, 35,0.12);color:#1c2e1d}",

    // ── Suggest toggle row (inside panel footer)
    ".ctx-suggest-row{padding:6px 12px 8px;display:flex;align-items:center;gap:8px;border-top:1px solid rgba(45, 70, 35, 0.32)}",
    ".ctx-suggest-label{font-size:10px;color:rgba(45, 70, 35,0.4);font-weight:600;flex:1;letter-spacing:0.3px}",
    ".ctx-suggest-toggle{position:relative;width:32px;height:18px;flex-shrink:0;cursor:pointer}",
    ".ctx-suggest-toggle input{opacity:0;width:0;height:0;position:absolute}",
    ".ctx-toggle-track{position:absolute;inset:0;border-radius:99px;background:rgba(45, 70, 35,0.12);transition:background .2s}",
    ".ctx-suggest-toggle input:checked + .ctx-toggle-track{background:#4f9437}",
    ".ctx-toggle-thumb{position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,0.4)}",
    ".ctx-suggest-toggle input:checked ~ .ctx-toggle-thumb{transform:translateX(14px)}",

    // ── Sidebar
    ".ctx-sidebar{position:fixed;top:0;right:-380px;width:340px;height:100vh;background:#f7faf2;border-left:1px solid rgba(45, 70, 35, 0.32);z-index:2147483645;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:right .28s cubic-bezier(0.4,0,0.2,1);box-shadow:-12px 0 40px rgba(0,0,0,0.5)}",
    ".ctx-sidebar.ctx-sidebar-open{right:0}",
    ".ctx-sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:15px 16px;font-size:14px;font-weight:800;color:#1c2e1d;flex-shrink:0;border-bottom:1px solid rgba(45, 70, 35, 0.32);background:linear-gradient(180deg,rgba(79, 148, 55,0.1) 0%,transparent 100%)}",
    ".ctx-sidebar-close{background:none;border:none;color:rgba(45, 70, 35,0.35);cursor:pointer;font-size:18px;line-height:1;padding:0;transition:color .15s}",
    ".ctx-sidebar-close:hover{color:#1c2e1d}",
    ".ctx-sidebar-search{display:flex;gap:7px;padding:10px 12px}",
    ".ctx-sidebar-search input{flex:1;background:rgba(45, 70, 35,0.06);border:1px solid rgba(45, 70, 35, 0.32);border-radius:9px;color:#1c2e1d;font-family:inherit;font-size:12px;outline:none;padding:8px 11px;transition:border-color .15s}",
    ".ctx-sidebar-search input:focus{border-color:rgba(79, 148, 55,0.45)}",
    ".ctx-sidebar-search input::placeholder{color:rgba(45, 70, 35,0.25)}",
    ".ctx-sidebar-search button{border:none;border-radius:9px;color:#fff;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;padding:8px 13px}",
    ".ctx-results{flex:1;overflow-y:auto;padding:0 10px 12px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin;scrollbar-color:rgba(45, 70, 35,0.08) transparent}",
    ".ctx-memory-card{background:rgba(45, 70, 35,0.04);border:1px solid rgba(45, 70, 35, 0.32);border-radius:10px;padding:11px 12px;transition:background .12s}",
    ".ctx-memory-card:hover{background:rgba(45, 70, 35,0.07)}",
    ".ctx-memory-title{font-size:12px;font-weight:700;color:#1c2e1d;margin-bottom:4px;line-height:1.3}",
    ".ctx-memory-preview{font-size:11px;color:rgba(45, 70, 35,0.42);line-height:1.5;margin-bottom:7px}",
    ".ctx-memory-actions{display:flex;gap:6px}",
    ".ctx-inject-btn{background:rgba(79, 148, 55,0.15);border:1px solid rgba(79, 148, 55,0.3);border-radius:6px;color:#2f6b34;cursor:pointer;font-family:inherit;font-size:10px;font-weight:700;padding:4px 10px;transition:all .15s}",
    ".ctx-inject-btn:hover{background:#4f9437;border-color:#4f9437;color:#fff}",
    ".ctx-loading,.ctx-empty,.ctx-error{font-size:12px;color:rgba(45, 70, 35,0.3);text-align:center;padding:28px 0}",
    ".ctx-error{color:#F87171}",

    // ── Save dialog
    ".ctx-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:2147483644}",
    ".ctx-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483645;background:#f7faf2;border:1px solid rgba(45, 70, 35, 0.32);border-radius:18px;width:440px;max-width:95vw;box-shadow:0 24px 64px rgba(0,0,0,0.7);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden}",
    ".ctx-modal-header{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;font-size:14px;font-weight:800;color:#1c2e1d;border-bottom:1px solid rgba(45, 70, 35, 0.32);background:rgba(79, 148, 55,0.08)}",
    ".ctx-close-btn{background:none;border:none;color:rgba(45, 70, 35,0.35);cursor:pointer;font-size:18px;line-height:1;padding:0;transition:color .15s}",
    ".ctx-close-btn:hover{color:#1c2e1d}",
    ".ctx-modal-body{padding:16px 18px;display:flex;flex-direction:column;gap:10px}",
    ".ctx-modal-body label{font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:rgba(45, 70, 35,0.38);display:block;margin-bottom:3px}",
    ".ctx-modal-body input,.ctx-modal-body textarea{background:rgba(45, 70, 35,0.06);border:1px solid rgba(45, 70, 35, 0.32);border-radius:9px;color:#1c2e1d;font-family:inherit;font-size:13px;outline:none;padding:9px 12px;width:100%;box-sizing:border-box;transition:border-color .15s}",
    ".ctx-modal-body input:focus,.ctx-modal-body textarea:focus{border-color:rgba(79, 148, 55,0.5)}",
    ".ctx-modal-body textarea{resize:vertical;min-height:90px}",
    ".ctx-status{font-size:12px;min-height:18px}",
    ".ctx-modal-footer{display:flex;gap:9px;justify-content:flex-end;padding:13px 18px;border-top:1px solid rgba(45, 70, 35, 0.32);background:rgba(0,0,0,0.15)}",
    ".ctx-btn-cancel{background:rgba(45, 70, 35,0.07);border:1px solid rgba(45, 70, 35, 0.32);border-radius:9px;color:rgba(45, 70, 35,0.55);cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;padding:9px 16px;transition:all .15s}",
    ".ctx-btn-cancel:hover{background:rgba(45, 70, 35,0.12)}",
    ".ctx-btn-save{border:none;border-radius:9px;color:#fff;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:9px 20px;transition:opacity .15s}",
    ".ctx-btn-save:hover{opacity:0.88}",

    // ── Keyframes
    "@keyframes ctxSlideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes ctxSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
    "@keyframes ctxPulse{0%,100%{opacity:0.25;transform:scale(1)}60%{opacity:0;transform:scale(1.35)}}",
    "@keyframes ctxPanelIn{from{opacity:0;transform:translateY(14px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}",

    // ── Inline suggestion dropdown ─────────────────────────────────────────────
    "#ctx-suggest-dropdown{position:fixed;background:#f7faf2;border:1px solid rgba(79, 148, 55,0.35);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,0.65),0 0 0 1px rgba(79, 148, 55,0.08);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:ctxFadeInDrop 0.14s ease;max-height:320px;overflow-y:auto}",
    ".ctx-si{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;transition:background .1s;font-size:12px;color:rgba(45, 70, 35,0.82);user-select:none}",
    ".ctx-si:hover,.ctx-si.ctx-selected{background:rgba(79, 148, 55,0.18);color:#1c2e1d}",
    ".ctx-si-icon{font-size:13px;flex-shrink:0;width:18px;text-align:center;opacity:0.7}",
    ".ctx-si-text{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".ctx-si-kind{font-size:9px;font-weight:700;color:rgba(45, 70, 35,0.2);flex-shrink:0;text-transform:uppercase;letter-spacing:0.4px}",
    ".ctx-si-sep{height:1px;background:rgba(45, 70, 35,0.06);margin:3px 0}",
    ".ctx-si-header{padding:6px 14px 3px;font-size:9px;font-weight:800;color:rgba(45, 70, 35,0.25);text-transform:uppercase;letter-spacing:0.5px}",
    ".ctx-si-footer{padding:5px 14px 7px;display:flex;gap:4px;align-items:center;border-top:1px solid rgba(45, 70, 35, 0.32);font-size:9px;color:rgba(45, 70, 35,0.22)}",
    ".ctx-si-footer kbd{background:rgba(45, 70, 35,0.08);border-radius:3px;padding:1px 5px;font-family:inherit;font-size:9px;color:rgba(45, 70, 35,0.35)}",
    "@keyframes ctxFadeInDrop{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}",
  ].join("\n");
  document.head.appendChild(style);
}

// ── FAB + floating panel ──────────────────────────────────────────────────────

var _currentPlatform = null;
var _panelOpen = false;
var _activeTab = "save";
var _panelMemCache = null;
var _panelProjCache = null;
// Set by injectFAB so the message listener below can open the panel
var _openPanelFn = null;
var _switchTabFn = null;

function injectFAB(platform) {
  _currentPlatform = platform;
  if (document.getElementById("ctx-fab")) return;
  injectStyles();

  var ac = (platform && platform.color) ? platform.color : "#4f9437";
  var pname = (platform && platform.name) ? platform.name : "AI";

  var fab = document.createElement("div");
  fab.id = "ctx-fab";
  fab.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

  fab.innerHTML =
    // ── Floating panel
    '<div id="ctx-panel">' +
      // Header
      '<div class="ctx-ph">' +
        '<span class="ctx-ph-icon">🧠</span>' +
        '<span class="ctx-ph-title">ContextOS</span>' +
        '<span class="ctx-ph-platform" style="background:' + ac + '22;color:' + ac + ';border:1px solid ' + ac + '44">' + escapeHtml(pname) + '</span>' +
        '<span class="ctx-ph-dot off" id="ctx-status-dot"></span>' +
        '<button class="ctx-ph-close" id="ctx-panel-close">×</button>' +
      '</div>' +
      // Tabs
      '<div class="ctx-tabs">' +
        '<button class="ctx-tab ctx-active" data-tab="save">💾 Save</button>' +
        '<button class="ctx-tab" data-tab="memories">🧠 Memory</button>' +
        '<button class="ctx-tab" data-tab="projects">📁 Projects</button>' +
        '<button class="ctx-tab" data-tab="search">🔍 Search</button>' +
      '</div>' +
      // Save tab
      '<div class="ctx-tc ctx-active" id="ctx-tc-save">' +
        '<div style="padding:14px">' +
          '<div style="font-size:11px;font-weight:700;color:rgba(45, 70, 35,0.4);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">Save current page to your brain</div>' +
          '<input id="ctx-save-title" style="width:100%;box-sizing:border-box;background:rgba(45, 70, 35,0.06);border:1px solid rgba(45, 70, 35, 0.32);border-radius:9px;color:#1c2e1d;font-family:inherit;font-size:12px;outline:none;padding:8px 11px;margin-bottom:8px;transition:border-color .15s" placeholder="Title…" />' +
          '<textarea id="ctx-save-content" rows="4" style="width:100%;box-sizing:border-box;background:rgba(45, 70, 35,0.06);border:1px solid rgba(45, 70, 35, 0.32);border-radius:9px;color:#1c2e1d;font-family:inherit;font-size:12px;outline:none;padding:8px 11px;resize:vertical;margin-bottom:8px;transition:border-color .15s" placeholder="Content…"></textarea>' +
          '<button id="ctx-quick-save-btn" style="width:100%;background:linear-gradient(135deg,#4f9437,#5fa83f);border:none;border-radius:10px;color:#fff;font-family:inherit;font-size:12px;font-weight:700;padding:10px;cursor:pointer;transition:opacity .15s">💾 Save to Brain</button>' +
          '<div id="ctx-save-status" style="font-size:11px;min-height:16px;margin-top:6px;text-align:center"></div>' +
        '</div>' +
      '</div>' +
      // Memories tab
      '<div class="ctx-tc" id="ctx-tc-memories">' +
        '<div class="ctx-search-wrap"><input id="ctx-mem-q" placeholder="Search memories…" autocomplete="off" /></div>' +
        '<div id="ctx-panel-mems" style="flex:1;overflow-y:auto"><div class="ctx-state"><span class="ctx-state-icon">🧠</span>Loading memories…</div></div>' +
      '</div>' +
      // Projects tab
      '<div class="ctx-tc" id="ctx-tc-projects">' +
        '<div id="ctx-panel-projs"><div class="ctx-state"><span class="ctx-state-icon">📁</span>Loading projects…</div></div>' +
      '</div>' +
      // Search tab
      '<div class="ctx-tc" id="ctx-tc-search">' +
        '<div class="ctx-search-wrap"><input id="ctx-panel-q" placeholder="Search memories…" autocomplete="off" /></div>' +
        '<div id="ctx-panel-sr"><div class="ctx-state"><span class="ctx-state-icon">🔍</span>Type to search…</div></div>' +
      '</div>' +
      // Footer
      '<div class="ctx-pf">' +
        '<button class="ctx-pf-save" id="ctx-pf-save">✨ Full Save Dialog</button>' +
        '<button class="ctx-pf-more" id="ctx-pf-more">Sidebar →</button>' +
      '</div>' +
      '<div class="ctx-suggest-row">' +
        '<span class="ctx-suggest-label">⚡ Auto-suggestions</span>' +
        '<label class="ctx-suggest-toggle">' +
          '<input type="checkbox" id="ctx-suggest-chk" />' +
          '<span class="ctx-toggle-track"></span>' +
          '<span class="ctx-toggle-thumb"></span>' +
        '</label>' +
      '</div>' +
    '</div>' +
    // ── Brain FAB button
    '<button id="ctx-fab-btn" title="ContextOS · drag to move"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#4f9437" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg></button>';

  document.body.appendChild(fab);

  var fabBtn   = document.getElementById("ctx-fab-btn");
  var panel    = document.getElementById("ctx-panel");
  var statusDot = document.getElementById("ctx-status-dot");

  // ── Ping status dot
  function refreshDot() {
    sendMessage("HEALTH_CHECK").then(function() {
      if (statusDot) { statusDot.classList.remove("off"); statusDot.title = "Connected"; }
    }).catch(function() {
      if (statusDot) { statusDot.classList.add("off"); statusDot.title = "Offline — check settings"; }
    });
  }
  refreshDot();

  // ── Drag to reposition ──────────────────────────────────────────────────────
  var dragging = false, dragMoved = false;
  var dragStartX, dragStartY, fabStartRight, fabStartBottom;
  var _fabRaf = 0, _fabPendingPos = null, _fabSaveTimer = null;

  function onFabMouseMove(e) {
    var dx = dragStartX - e.clientX;
    var dy = dragStartY - e.clientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    _fabPendingPos = {
      right:  Math.max(4, Math.min(window.innerWidth  - 56, fabStartRight  + dx)),
      bottom: Math.max(4, Math.min(window.innerHeight - 56, fabStartBottom + dy)),
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
    document.removeEventListener("mouseup", onFabMouseUp);
    if (_fabRaf) { cancelAnimationFrame(_fabRaf); _fabRaf = 0; }
    clearTimeout(_fabSaveTimer);
    _fabSaveTimer = setTimeout(function() {
      try { chrome.storage.sync.set({ fabRight: fab.style.right, fabBottom: fab.style.bottom }); } catch(_) {}
    }, 400);
  }

  fabBtn.addEventListener("mousedown", function(e) {
    if (e.button !== 0) return;
    dragging = true; dragMoved = false;
    dragStartX = e.clientX; dragStartY = e.clientY;
    var rect = fab.getBoundingClientRect();
    fabStartRight  = window.innerWidth  - rect.right;
    fabStartBottom = window.innerHeight - rect.bottom;
    fab.style.transition = "none";
    document.addEventListener("mousemove", onFabMouseMove, { passive: true });
    document.addEventListener("mouseup", onFabMouseUp, { passive: true });
    e.preventDefault();
  });

  try {
    chrome.storage.sync.get(["fabRight", "fabBottom"], function(r) {
      if (r.fabRight)  fab.style.right  = r.fabRight;
      if (r.fabBottom) fab.style.bottom = r.fabBottom;
    });
  } catch(_) {}

  // ── Panel open/close ────────────────────────────────────────────────────────
  function openPanel() {
    _panelOpen = true;

    // Smart direction: if FAB is in the top half of the screen, open panel downward
    var fabRect = fab.getBoundingClientRect();
    var isTopHalf = fabRect.top < window.innerHeight / 2;
    panel.style.bottom = "";
    panel.style.top = "";
    if (isTopHalf) {
      panel.style.top = (fabRect.height + 8) + "px";
    } else {
      panel.style.bottom = (fabRect.height + 8) + "px";
    }

    panel.classList.add("ctx-open");
    // Load active tab data
    switchTab(_activeTab);
    refreshDot();
    // Close on outside click
    setTimeout(function() {
      document.addEventListener("click", onOutsideClick);
    }, 0);
  }

  function closePanel() {
    _panelOpen = false;
    panel.classList.remove("ctx-open");
    document.removeEventListener("click", onOutsideClick);
  }

  function onOutsideClick(e) {
    if (!fab.contains(e.target)) closePanel();
  }

  fabBtn.onclick = function(e) {
    if (dragMoved) { dragMoved = false; return; }
    e.stopPropagation();
    if (_panelOpen) closePanel(); else openPanel();
  };

  document.getElementById("ctx-panel-close").onclick = function(e) {
    e.stopPropagation();
    closePanel();
  };

  // ── Tab switching ────────────────────────────────────────────────────────────
  function switchTab(name) {
    _activeTab = name;
    document.querySelectorAll("#ctx-panel .ctx-tab").forEach(function(t) {
      t.classList.toggle("ctx-active", t.dataset.tab === name);
    });
    document.querySelectorAll("#ctx-panel .ctx-tc").forEach(function(tc) {
      tc.classList.remove("ctx-active");
    });
    var tc = document.getElementById("ctx-tc-" + name);
    if (tc) tc.classList.add("ctx-active");

    if (name === "save")     initSaveTab();
    if (name === "memories") loadPanelMemories();
    if (name === "projects") loadPanelProjects();
    if (name === "search")   setTimeout(function() { var q = document.getElementById("ctx-panel-q"); if(q) q.focus(); }, 50);
  }

  // Expose to module-level message listener so right-click can open the panel
  _openPanelFn = openPanel;
  _switchTabFn = switchTab;

  document.querySelectorAll("#ctx-panel .ctx-tab").forEach(function(btn) {
    btn.onclick = function(e) { e.stopPropagation(); switchTab(btn.dataset.tab); };
  });

  // ── Footer buttons ──────────────────────────────────────────────────────────
  document.getElementById("ctx-pf-save").onclick = function(e) {
    e.stopPropagation();
    closePanel();
    showSaveDialog(getPageText());
  };
  document.getElementById("ctx-pf-more").onclick = function(e) {
    e.stopPropagation();
    closePanel();
    toggleSidebar();
  };

  // ── Search tab ──────────────────────────────────────────────────────────────
  var _searchTimer;
  var panelQ = document.getElementById("ctx-panel-q");
  if (panelQ) {
    panelQ.addEventListener("input", function() {
      clearTimeout(_searchTimer);
      var q = panelQ.value.trim();
      var sr = document.getElementById("ctx-panel-sr");
      if (!q) {
        if (sr) sr.innerHTML = '<div class="ctx-state"><span class="ctx-state-icon">🔍</span>Type to search…</div>';
        return;
      }
      if (sr) sr.innerHTML = '<div class="ctx-state"><span style="display:inline-block;animation:ctxSpin 1s linear infinite">⟳</span> Searching…</div>';
      _searchTimer = setTimeout(function() { runPanelSearch(q); }, 350);
    });
    panelQ.addEventListener("click", function(e) { e.stopPropagation(); });
  }

  // ── Memory tab search ────────────────────────────────────────────────────────
  var _memSearchTimer;
  var memQ = document.getElementById("ctx-mem-q");
  if (memQ) {
    memQ.addEventListener("input", function() {
      clearTimeout(_memSearchTimer);
      var q = memQ.value.trim();
      var memsEl = document.getElementById("ctx-panel-mems");
      if (!q) {
        // show cached list (or reload if cache is gone)
        if (_panelMemCache) renderPanelMems(_panelMemCache);
        else loadPanelMemories();
        return;
      }
      if (memsEl) memsEl.innerHTML = '<div class="ctx-state"><span style="display:inline-block;animation:ctxSpin 1s linear infinite">⟳</span> Searching…</div>';
      _memSearchTimer = setTimeout(function() {
        sendMessage("SEARCH_MEMORY", { query: q, limit: 12 }).then(function(data) {
          var results = Array.isArray(data) ? data : (data.results || []);
          renderPanelMems(results);
        }).catch(function(err) {
          if (memsEl) renderPanelError(memsEl, err);
        });
      }, 350);
    });
    memQ.addEventListener("click", function(e) { e.stopPropagation(); });
  }

  // ── Auto-suggest toggle (checkbox) ─────────────────────────────────────────
  var suggestChk = document.getElementById("ctx-suggest-chk");
  try {
    chrome.storage.sync.get(["suggestEnabled"], function(r) {
      _suggestEnabled = r.suggestEnabled === true;
      _autoSuggestOn = _suggestEnabled;
      if (suggestChk) suggestChk.checked = _suggestEnabled;
    });
  } catch(_) {}

  if (suggestChk) {
    suggestChk.onclick = function(e) { e.stopPropagation(); };
    suggestChk.onchange = function() {
      _suggestEnabled = suggestChk.checked;
      _autoSuggestOn  = _suggestEnabled;
      try { chrome.storage.sync.set({ suggestEnabled: _suggestEnabled }); } catch(_) {}

      var confirmPill = document.createElement("div");
      confirmPill.style.cssText = "position:fixed;bottom:88px;right:20px;z-index:2147483647;background:#eef3e7;border:1px solid rgba(79, 148, 55,0.4);border-left:3px solid #4f9437;border-radius:20px;padding:7px 14px;font-size:11px;font-weight:600;color:#2f6b34;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:ctxSlideIn 0.18s ease";
      confirmPill.textContent = _suggestEnabled ? "⚡ Auto-suggestions ON" : "🔇 Auto-suggestions OFF";
      document.body.appendChild(confirmPill);
      setTimeout(function() { confirmPill.remove(); }, 2400);

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
}

// ── Panel: save tab ───────────────────────────────────────────────────────────

var _saveTabInited = false;
function initSaveTab() {
  if (_saveTabInited) return;
  _saveTabInited = true;

  // Pre-fill title from page, content from actual chat text
  var titleEl   = document.getElementById("ctx-save-title");
  var contentEl = document.getElementById("ctx-save-content");
  if (titleEl && !titleEl.value) titleEl.value = document.title.slice(0, 120);
  if (contentEl && !contentEl.value) {
    var chatText = getPageText(); // reads the actual AI conversation text
    contentEl.value = chatText
      ? chatText.slice(0, MAX_CHARS)
      : "Source: " + window.location.href;
  }

  // Focus border on inputs
  [titleEl, contentEl].forEach(function(el) {
    if (!el) return;
    el.addEventListener("focus",  function() { el.style.borderColor = "rgba(79, 148, 55,0.5)"; });
    el.addEventListener("blur",   function() { el.style.borderColor = "rgba(45, 70, 35,0.1)"; });
    el.addEventListener("click",  function(e) { e.stopPropagation(); });
  });

  var saveBtn   = document.getElementById("ctx-quick-save-btn");
  var statusEl  = document.getElementById("ctx-save-status");
  if (!saveBtn) return;

  saveBtn.onclick = async function(e) {
    e.stopPropagation();
    var title   = (titleEl   && titleEl.value.trim())   || document.title.slice(0, 120);
    var content = (contentEl && contentEl.value.trim()) || "";
    if (!title || !content) {
      statusEl.textContent = "Title and content required.";
      statusEl.style.color = "#F87171";
      return;
    }
    saveBtn.disabled = true; saveBtn.textContent = "Saving…";
    statusEl.textContent = ""; statusEl.style.color = "";
    ctxStatusToast(navigator.onLine ? "saving" : "offline");
    try {
      await sendMessage("SAVE_MEMORY", { title: title, content: content, doc_type: "note", tags: [] });
      _panelMemCache = null; // bust cache so memories tab refreshes
      ctxStatusToast("saved");
      saveBtn.textContent = "✓ Saved!";
      saveBtn.style.background = "#10B981";
      if (titleEl)   titleEl.value   = "";
      if (contentEl) contentEl.value = "";
      _saveTabInited = false; // allow re-init next time
      statusEl.textContent = "Memory saved to your brain.";
      statusEl.style.color = "#6EE7B7";
      setTimeout(function() {
        saveBtn.disabled = false;
        saveBtn.textContent = "💾 Save to Brain";
        saveBtn.style.background = "";
        statusEl.textContent = "";
        _saveTabInited = false;
      }, 2000);
    } catch(err) {
      saveBtn.disabled = false; saveBtn.textContent = "💾 Save to Brain";
      if (!navigator.onLine) ctxStatusToast("offline");
      else if (isLimitError(err)) ctxStatusToast("limit");
      else if (ctxIsAuthError(err)) ctxStatusToast("signin");
      else ctxStatusToast("error", { retry: function(){ if (!saveBtn.disabled) saveBtn.click(); } });
      if (isLimitError(err)) {
        showLimitError(statusEl);
      } else {
        statusEl.textContent = friendlyPanelError(err) || "Failed to save.";
        statusEl.style.color = "#F87171";
      }
    }
  };
}

// ── Panel: load memories ──────────────────────────────────────────────────────

function formatRelTime(iso) {
  if (!iso) return "";
  try {
    var d = new Date(iso);
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60)     return "just now";
    if (diff < 3600)   return Math.floor(diff / 60)   + "m ago";
    if (diff < 86400)  return Math.floor(diff / 3600)  + "h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch (_) { return ""; }
}

function loadPanelMemories() {
  if (_panelMemCache) { renderPanelMems(_panelMemCache); return; }
  var el = document.getElementById("ctx-panel-mems");
  if (!el) return;
  el.innerHTML = '<div class="ctx-state"><span style="display:inline-block;animation:ctxSpin 1s linear infinite">⟳</span> Loading…</div>';
  sendMessage("LIST_MEMORY", { page: 1, perPage: 12 }).then(function(data) {
    _panelMemCache = Array.isArray(data) ? data : (data.items || []);
    renderPanelMems(_panelMemCache);
  }).catch(function(err) {
    if (el) renderPanelError(el, err);
  });
}

function renderPanelMems(items) {
  var el = document.getElementById("ctx-panel-mems");
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '<div class="ctx-state"><span class="ctx-state-icon">🧠</span>No memories yet. Save your first one!</div>';
    return;
  }
  var typeIcon = { note:"📝", code:"💻", reference:"🔗", idea:"💡", research:"🔬", prompt:"⚙️", pdf:"📄" };
  el.innerHTML = items.map(function(m) {
    var icon = typeIcon[m.doc_type] || "📝";
    var preview = (m.content || "").replace(/\n/g," ").slice(0,80);
    var ts = formatRelTime(m.created_at);
    return (
      '<div class="ctx-item" data-content="' + escapeHtml(m.content || "") + '">' +
        '<span class="ctx-item-icon">' + icon + '</span>' +
        '<span class="ctx-item-body">' +
          '<div class="ctx-item-title">' + escapeHtml((m.title||"Untitled").slice(0,50)) + '</div>' +
          (preview ? '<div class="ctx-item-sub">' + escapeHtml(preview) + (m.content&&m.content.length>80?"…":"") + '</div>' : '') +
          (ts ? '<div class="ctx-item-ts">' + ts + '</div>' : '') +
        '</span>' +
        '<button class="ctx-inject-btn" title="Inject into chat">⚡ Use</button>' +
      '</div>'
    );
  }).join("") +
  '<div style="padding:10px 14px;text-align:center">' +
    '<button id="ctx-mem-viewall" style="background:none;border:none;color:rgba(45, 70, 35,0.3);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:0.3px;font-family:inherit;text-transform:uppercase">View all memories →</button>' +
  '</div>';

  el.querySelectorAll(".ctx-inject-btn").forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      var item = btn.closest(".ctx-item");
      injectIntoInput(item ? item.dataset.content : "");
      btn.textContent = "✓ Done";
      btn.style.background = "#10B981";
      btn.style.borderColor = "#10B981";
      btn.style.color = "#fff";
      setTimeout(function() { btn.textContent = "⚡ Use"; btn.style.background = ""; btn.style.borderColor = ""; btn.style.color = ""; }, 1500);
    };
  });

  var va = document.getElementById("ctx-mem-viewall");
  if (va) va.onclick = function(e) {
    e.stopPropagation();
    var panel = document.getElementById("ctx-panel");
    if (panel) panel.classList.remove("ctx-open");
    _panelOpen = false;
    toggleSidebar();
  };
}

// ── Panel: load projects ──────────────────────────────────────────────────────

function loadPanelProjects() {
  if (_panelProjCache) { renderPanelProjs(_panelProjCache); return; }
  var el = document.getElementById("ctx-panel-projs");
  if (!el) return;
  el.innerHTML = '<div class="ctx-state"><span style="display:inline-block;animation:ctxSpin 1s linear infinite">⟳</span> Loading…</div>';
  sendMessage("LIST_PROJECTS").then(function(data) {
    _panelProjCache = (data && data.items) ? data.items : [];
    renderPanelProjs(_panelProjCache);
  }).catch(function(err) {
    if (el) renderPanelError(el, err);
  });
}

function renderPanelProjs(items) {
  var el = document.getElementById("ctx-panel-projs");
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '<div class="ctx-state"><span class="ctx-state-icon">📁</span>No projects yet. Create one in the web app!</div>';
    return;
  }
  el.innerHTML = items.map(function(p) {
    var emoji = getProjectEmoji(p.name);
    return (
      '<div class="ctx-proj-item" data-id="' + escapeHtml(p.id||"") + '" data-ctx="' + escapeHtml(buildProjContext(p)) + '">' +
        '<div class="ctx-proj-emoji">' + emoji + '</div>' +
        '<div class="ctx-proj-info">' +
          '<div class="ctx-proj-name">' + escapeHtml((p.name||"Unnamed").slice(0,40)) + '</div>' +
          (p.description ? '<div class="ctx-proj-desc">' + escapeHtml(p.description.slice(0,60)) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">' +
          '<span class="ctx-proj-arrow">›</span>' +
          '<button class="ctx-inject-btn ctx-proj-inject" style="font-size:10px;padding:3px 8px" title="Inject project context into chat">⚡ Use</button>' +
        '</div>' +
      '</div>'
    );
  }).join("");

  el.querySelectorAll(".ctx-proj-item").forEach(function(row) {
    row.onclick = function(e) {
      if (e.target && e.target.classList.contains("ctx-proj-inject")) return;
      getWebAppUrl("/projects/" + row.dataset.id).then(function(url) {
        window.open(url, "_blank");
      });
    };
  });
  el.querySelectorAll(".ctx-proj-inject").forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      var row = btn.closest(".ctx-proj-item");
      injectIntoInput(row ? row.dataset.ctx : "");
      btn.textContent = "✓";
      btn.style.background = "#10B981"; btn.style.borderColor = "#10B981"; btn.style.color = "#fff";
      setTimeout(function() { btn.textContent = "⚡ Use"; btn.style.background = ""; btn.style.borderColor = ""; btn.style.color = ""; }, 1500);
    };
  });
}

function buildProjContext(p) {
  var parts = ["Project: " + (p.name || "Unnamed")];
  if (p.description) parts.push(p.description);
  if (p.goals)       parts.push("Goals: " + p.goals);
  return parts.join("\n");
}

function getProjectEmoji(name) {
  var n = (name||"").toLowerCase();
  if (n.includes("web")||n.includes("site")) return "🌐";
  if (n.includes("app")||n.includes("mobile")) return "📱";
  if (n.includes("api")||n.includes("back")) return "⚙️";
  if (n.includes("design")||n.includes("ui")) return "🎨";
  if (n.includes("ai")||n.includes("ml")||n.includes("llm")) return "🤖";
  if (n.includes("data")||n.includes("analytics")) return "📊";
  if (n.includes("doc")||n.includes("write")||n.includes("blog")) return "📝";
  if (n.includes("game")) return "🎮";
  return "📁";
}

// ── Panel: search ─────────────────────────────────────────────────────────────

function runPanelSearch(q) {
  var sr  = document.getElementById("ctx-panel-sr");
  var ql  = q.toLowerCase();

  // Run memory search + project filter in parallel
  var memPromise  = sendMessage("SEARCH_MEMORY", { query: q, limit: 8 }).catch(function() { return { items: [] }; });
  var projPromise = (
    _panelProjCache
      ? Promise.resolve(_panelProjCache)
      : sendMessage("LIST_PROJECTS").then(function(d) { _panelProjCache = d && d.items ? d.items : []; return _panelProjCache; }).catch(function() { return []; })
  ).then(function(projs) {
    return projs.filter(function(p) {
      return (p.name||"").toLowerCase().includes(ql) || (p.description||"").toLowerCase().includes(ql);
    });
  });

  Promise.all([memPromise, projPromise]).then(function(results) {
    var memData  = results[0];
    var memories = Array.isArray(memData) ? memData : (memData.results || memData.items || []);
    var projects = results[1] || [];

    if (!sr) return;
    if (!memories.length && !projects.length) {
      sr.innerHTML = '<div class="ctx-state"><span class="ctx-state-icon">🔍</span>No results for "' + escapeHtml(q) + '"</div>';
      return;
    }

    var html = "";

    // Projects section
    if (projects.length) {
      html += '<div style="padding:7px 14px 4px;font-size:9px;font-weight:800;color:rgba(45, 70, 35,0.3);text-transform:uppercase;letter-spacing:0.5px">Projects</div>';
      html += projects.map(function(p) {
        return (
          '<div class="ctx-proj-item" data-id="' + escapeHtml(p.id||"") + '" data-ctx="' + escapeHtml(buildProjContext(p)) + '">' +
            '<div class="ctx-proj-emoji">' + getProjectEmoji(p.name) + '</div>' +
            '<div class="ctx-proj-info">' +
              '<div class="ctx-proj-name">' + escapeHtml((p.name||"Unnamed").slice(0,40)) + '</div>' +
              (p.description ? '<div class="ctx-proj-desc">' + escapeHtml(p.description.slice(0,50)) + '</div>' : '') +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">' +
              '<span class="ctx-proj-arrow">›</span>' +
              '<button class="ctx-inject-btn ctx-proj-inject" style="font-size:10px;padding:3px 8px">⚡ Use</button>' +
            '</div>' +
          '</div>'
        );
      }).join("");
    }

    // Memories section
    if (memories.length) {
      if (projects.length) html += '<div style="padding:7px 14px 4px;font-size:9px;font-weight:800;color:rgba(45, 70, 35,0.3);text-transform:uppercase;letter-spacing:0.5px">Memories</div>';
      html += memories.map(function(m) {
        var preview = (m.content||"").replace(/\n/g," ").slice(0,70);
        return (
          '<div class="ctx-item" data-content="' + escapeHtml(m.content||"") + '">' +
            '<span class="ctx-item-body">' +
              '<div class="ctx-item-title">' + escapeHtml((m.title||"Untitled").slice(0,50)) + '</div>' +
              (preview ? '<div class="ctx-item-sub">' + escapeHtml(preview) + '…</div>' : '') +
            '</span>' +
            '<button class="ctx-inject-btn">⚡ Use</button>' +
          '</div>'
        );
      }).join("");
    }

    sr.innerHTML = html;

    // Wire project clicks + inject
    sr.querySelectorAll(".ctx-proj-item").forEach(function(row) {
      row.onclick = function(e) {
        if (e.target && e.target.classList.contains("ctx-proj-inject")) return;
        getWebAppUrl("/projects/" + row.dataset.id).then(function(url) { window.open(url, "_blank"); });
      };
    });
    sr.querySelectorAll(".ctx-proj-inject").forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var row = btn.closest(".ctx-proj-item");
        injectIntoInput(row ? row.dataset.ctx : "");
        btn.textContent = "✓";
        btn.style.background = "#10B981"; btn.style.borderColor = "#10B981"; btn.style.color = "#fff";
        setTimeout(function() { btn.textContent = "⚡ Use"; btn.style.background = ""; btn.style.borderColor = ""; btn.style.color = ""; }, 1500);
      };
    });

    // Wire inject buttons
    sr.querySelectorAll(".ctx-inject-btn").forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var item = btn.closest(".ctx-item");
        injectIntoInput(item ? item.dataset.content : "");
        btn.textContent = "✓";
        btn.style.background = "#10B981"; btn.style.borderColor = "#10B981"; btn.style.color = "#fff";
        setTimeout(function() { btn.textContent = "⚡ Use"; btn.style.background=""; btn.style.borderColor=""; btn.style.color=""; }, 1500);
      };
    });
  }).catch(function(err) {
    if (sr) sr.innerHTML = '<div class="ctx-state ctx-error-state"><span class="ctx-state-icon">⚠️</span>' + escapeHtml(friendlyPanelError(err)) + '</div>';
  });
}

function friendlyPanelError(err) {
  var m = (err && err.message) || "";
  if (m.includes("LIMIT_REACHED"))  return null; // handled by showPanelUpgrade
  if (m.includes("NOT_CONFIGURED")) return "Not connected. Open the extension popup to connect.";
  if (m.includes("QUEUED"))         return "Offline — saved locally, will sync when reconnected.";
  if (m.includes("NETWORK_ERROR"))  return "Unable to sync right now.";
  if (m.includes("AUTH_ERROR"))     return "Bad API key. Open popup → Settings to reconnect.";
  return m.replace(/^(API_ERROR \d+:|NETWORK_ERROR:|AUTH_ERROR:)\s*/,"") || "Something went wrong.";
}

function showPanelUpgrade(container) {
  container.innerHTML =
    '<div class="ctx-state" style="gap:10px">' +
      '<span class="ctx-state-icon">🔒</span>' +
      '<div style="font-size:12px;font-weight:700;color:#F87171">Memory limit reached</div>' +
      '<div style="font-size:11px;color:rgba(45, 70, 35,0.4);line-height:1.5">Upgrade to save unlimited memories and keep building your second brain.</div>' +
      '<button id="ctx-panel-upgrade" style="background:linear-gradient(135deg,#4f9437,#5fa83f);border:none;border-radius:10px;color:#fff;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:10px 20px;box-shadow:0 4px 14px rgba(79, 148, 55,0.45);margin-top:2px">⚡ Upgrade to Pro</button>' +
    '</div>';
  getWebAppUrl("/pricing").then(function(url) {
    var btn = container.querySelector("#ctx-panel-upgrade");
    if (btn) btn.onclick = function() { window.open(url, "_blank"); };
  });
}

function renderPanelError(container, err) {
  if (isLimitError(err)) { showPanelUpgrade(container); return; }
  var msg = friendlyPanelError(err) || "Something went wrong.";
  container.innerHTML = '<div class="ctx-state ctx-error-state"><span class="ctx-state-icon">⚠️</span>' + escapeHtml(msg) + '</div>';
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
        var u    = new URL(r.apiUrl || "https://contextos-production-d82a.up.railway.app");
        var port = u.port === "8000" ? "5173" : u.port;
        resolve(u.protocol + "//" + u.hostname + (port ? ":" + port : "") + path);
      } catch(_) {
        resolve("https://contextos-eta.vercel.app" + path);
      }
    });
  });
}

function showLimitError(statusEl) {
  statusEl.innerHTML =
    '<div style="color:#F87171;font-size:12px;font-weight:700;margin-bottom:8px">Memory limit reached</div>' +
    '<button id="ctx-upgrade-btn" style="' +
      'display:inline-flex;align-items:center;gap:6px;' +
      'background:linear-gradient(135deg,#4f9437,#5fa83f);' +
      'border:none;border-radius:9px;color:#fff;cursor:pointer;' +
      'font-size:12px;font-weight:700;padding:9px 20px;' +
      'box-shadow:0 4px 14px rgba(79, 148, 55,0.45)' +
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
  var accentColor = (platform && platform.color) ? platform.color : "#4f9437";
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
      ".ctx-page-capture{display:flex;align-items:center;gap:8px;background:rgba(45, 70, 35,0.04);border:1px solid rgba(45, 70, 35, 0.32);border-radius:8px;padding:8px 10px;margin-bottom:2px}",
      ".ctx-page-favicon{width:16px;height:16px;border-radius:3px;flex-shrink:0}",
      ".ctx-page-info{flex:1;min-width:0}",
      ".ctx-page-title{font-size:11px;font-weight:600;color:#1c2e1d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".ctx-page-url{font-size:10px;color:rgba(45, 70, 35,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".ctx-type-chips{display:flex;gap:6px;flex-wrap:wrap}",
      ".ctx-type-chip{border:1px solid rgba(45, 70, 35, 0.32);border-radius:20px;padding:5px 12px;font-size:11px;font-weight:600;color:rgba(45, 70, 35,0.55);cursor:pointer;background:transparent;transition:all .15s;white-space:nowrap}",
      ".ctx-type-chip.active{color:#1c2e1d;border-color:transparent}",
      ".ctx-char-bar-wrap{height:2px;background:rgba(45, 70, 35,0.07);border-radius:2px;margin-top:4px}",
      ".ctx-char-bar{height:2px;border-radius:2px;transition:width .2s,background .2s}",
      ".ctx-char-count{font-size:10px;color:rgba(45, 70, 35,0.3);text-align:right;margin-top:3px}",
      ".ctx-tag-area{display:flex;flex-wrap:wrap;gap:5px;align-items:center;background:rgba(45, 70, 35,0.06);border:1px solid rgba(45, 70, 35, 0.32);border-radius:8px;padding:6px 8px;min-height:34px;cursor:text}",
      ".ctx-tag-pill{display:flex;align-items:center;gap:4px;background:rgba(79, 148, 55,0.25);border:1px solid rgba(79, 148, 55,0.4);border-radius:12px;padding:2px 8px;font-size:11px;color:#2f6b34}",
      ".ctx-tag-pill span{cursor:pointer;opacity:0.6;font-size:13px;line-height:1}",
      ".ctx-tag-pill span:hover{opacity:1}",
      ".ctx-tag-input{background:transparent;border:none;outline:none;color:#1c2e1d;font-size:12px;font-family:inherit;min-width:80px;flex:1}",
      ".ctx-tag-input::placeholder{color:rgba(45, 70, 35,0.25)}",
      "@keyframes ctxSuccessPop{0%{transform:scale(0.7);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}",
      ".ctx-success{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;text-align:center;gap:10px}",
      ".ctx-success-icon{font-size:44px;animation:ctxSuccessPop 0.4s ease forwards}",
      ".ctx-success-title{font-size:15px;font-weight:700;color:#1c2e1d}",
      ".ctx-success-sub{font-size:12px;color:rgba(45, 70, 35,0.45)}",
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
    var map = { note: "#4f9437", code: "#10B981", reference: "#F59E0B", idea: "#EC4899" };
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
      ctxStatusToast(navigator.onLine ? "saving" : "offline");

      try {
        await sendMessage("SAVE_MEMORY", {
          title:   title,
          content: content,
          doc_type: selectedType,
          tags:    tags,
        });
        _lastSuggestedQuery = "";
        ctxStatusToast("saved");
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
        if (!navigator.onLine) ctxStatusToast("offline");
        else if (isLimitError(err)) ctxStatusToast("limit");
        else if (ctxIsAuthError(err)) ctxStatusToast("signin");
        else ctxStatusToast("error", { retry: function(){ var b=dialog.querySelector("#ctx-dlg-save"); if (b) b.click(); } });
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
  var accentColor = (platform && platform.color) ? platform.color : "#4f9437";

  var sidebar = document.createElement("div");
  sidebar.id = "ctx-sidebar";
  sidebar.className = "ctx-sidebar ctx-sidebar-open";
  sidebar.innerHTML =
    '<div class="ctx-sidebar-header" style="border-bottom:2px solid ' + accentColor + '">' +
      '<span>🧠 ContextOS — Second Brain</span>' +
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
      renderMemories(Array.isArray(data) ? data : (data.items || []), results);
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

// ── Inline suggestion engine ──────────────────────────────────────────────────
// LRU cache: 200 entries, 10-min TTL. Cache hits are instant — zero latency.

var _ctxSuggestCache = (function() {
  var map = new Map();
  var CAP = 200, TTL = 10 * 60 * 1000;
  return {
    get: function(k) {
      var e = map.get(k);
      if (!e) return null;
      if (Date.now() > e.exp) { map.delete(k); return null; }
      map.delete(k); map.set(k, e); // freshen entry (LRU)
      return e.v;
    },
    set: function(k, v) {
      map.delete(k);
      if (map.size >= CAP) map.delete(map.keys().next().value); // evict oldest
      map.set(k, { v: v, exp: Date.now() + TTL });
    },
  };
})();

// Recent prompts — persisted in localStorage (max 30)
var _RECENT_KEY  = "ctos_ext_recents";
var _MAX_RECENTS = 30;

function getRecentPrompts() {
  try { return JSON.parse(localStorage.getItem(_RECENT_KEY) || "[]"); } catch(_) { return []; }
}
function saveRecentPrompt(text) {
  if (!text || text.length < 6) return;
  try {
    var list = getRecentPrompts().filter(function(s) { return s !== text; });
    list.unshift(text);
    localStorage.setItem(_RECENT_KEY, JSON.stringify(list.slice(0, _MAX_RECENTS)));
  } catch(_) {}
}
function matchingRecents(query) {
  var q = query.toLowerCase();
  return getRecentPrompts().filter(function(s) { return s.toLowerCase().includes(q); }).slice(0, 3);
}

// ── Dropdown state ────────────────────────────────────────────────────────────

var _sugDropdown = null;
var _sugItems    = [];
var _sugSelIdx   = -1;
var _sugInput    = null;

function hideSuggestDropdown() {
  if (_sugDropdown) {
    if (_sugDropdown._outerMd) document.removeEventListener("mousedown", _sugDropdown._outerMd, true);
    _sugDropdown.remove();
    _sugDropdown = null;
  }
  _sugItems = []; _sugSelIdx = -1; _sugInput = null;
}

function positionDropdown(dd, input) {
  var rect = input.getBoundingClientRect();
  var h    = dd.offsetHeight || 240;
  var showAbove = (window.innerHeight - rect.bottom < h + 10) && (rect.top > h + 10);
  dd.style.top  = showAbove ? (rect.top - h - 6) + "px" : (rect.bottom + 6) + "px";
  dd.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 490)) + "px";
  dd.style.width = Math.min(Math.max(rect.width, 300), 480) + "px";
}

function setSugSelIdx(idx) {
  _sugSelIdx = idx;
  if (!_sugDropdown) return;
  _sugDropdown.querySelectorAll(".ctx-si[data-idx]").forEach(function(el) {
    el.classList.toggle("ctx-selected", parseInt(el.dataset.idx) === idx);
  });
}

function acceptSuggestion(idx) {
  if (idx < 0 || idx >= _sugItems.length) { hideSuggestDropdown(); return; }
  var item  = _sugItems[idx];
  var input = _sugInput;
  hideSuggestDropdown();
  if (!input) return;

  if (item.type === "recent") {
    // Replace input text with the full previous prompt
    if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
      var ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value") &&
               Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      if (ns) ns.call(input, item.text); else input.value = item.text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (input.getAttribute("contenteditable")) {
      input.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, item.text);
    }
  } else {
    // Inject memory context into the current prompt
    injectIntoInput(item.text);
  }
}

function renderSuggestDropdown(recentItems, memItems, input, accentColor) {
  hideSuggestDropdown();
  if (!recentItems.length && !memItems.length) return;

  _sugInput = input;
  _sugItems = [];

  var dd = document.createElement("div");
  dd.id  = "ctx-suggest-dropdown";
  // Apply accent border color inline (overrides the base style's left-border)
  dd.style.borderLeftColor = accentColor || "#4f9437";

  var html = "";

  if (recentItems.length) {
    html += '<div class="ctx-si-header">Recent prompts</div>';
    recentItems.forEach(function(text) {
      var i = _sugItems.length;
      _sugItems.push({ type: "recent", text: text });
      html += '<div class="ctx-si" data-idx="' + i + '">' +
        '<span class="ctx-si-icon">🕐</span>' +
        '<span class="ctx-si-text">' + escapeHtml(text.slice(0, 80)) + '</span>' +
        '<span class="ctx-si-kind">recent</span></div>';
    });
  }

  if (memItems.length) {
    if (recentItems.length) html += '<div class="ctx-si-sep"></div>';
    html += '<div class="ctx-si-header">From your brain 🧠</div>';
    memItems.forEach(function(mem) {
      var i     = _sugItems.length;
      var label = (mem.title || "Untitled").slice(0, 70);
      _sugItems.push({ type: "memory", text: mem.content || "", label: label });
      html += '<div class="ctx-si" data-idx="' + i + '">' +
        '<span class="ctx-si-icon">📝</span>' +
        '<span class="ctx-si-text">' + escapeHtml(label) + '</span>' +
        '<span class="ctx-si-kind">memory</span></div>';
    });
  }

  html += '<div class="ctx-si-footer">' +
    '<kbd>↑↓</kbd>&nbsp;navigate&nbsp;&nbsp;' +
    '<kbd>↵</kbd>&nbsp;accept&nbsp;&nbsp;' +
    '<kbd>Tab</kbd>&nbsp;use&nbsp;&nbsp;' +
    '<kbd>Esc</kbd>&nbsp;close' +
  '</div>';

  dd.innerHTML = html;
  document.body.appendChild(dd);
  _sugDropdown = dd;

  // Position after the browser has painted (offsetHeight available)
  requestAnimationFrame(function() { if (_sugDropdown === dd) positionDropdown(dd, input); });

  // Item interactions
  dd.querySelectorAll(".ctx-si[data-idx]").forEach(function(el) {
    el.onmousedown  = function(e) { e.preventDefault(); acceptSuggestion(parseInt(el.dataset.idx)); };
    el.onmouseenter = function()  { setSugSelIdx(parseInt(el.dataset.idx)); };
  });

  // Close on outside click (added after a tick so this open-click doesn't trigger it)
  var onOutsideMd = function(e) { if (dd && !dd.contains(e.target)) hideSuggestDropdown(); };
  dd._outerMd = onOutsideMd;
  setTimeout(function() { document.addEventListener("mousedown", onOutsideMd, true); }, 0);
}

// ── Keyboard handler (attached to each watched input, capture phase) ──────────

function buildKeydownHandler() {
  return function(e) {
    if (!_sugDropdown || !_sugItems.length) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSugSelIdx(Math.min(_sugSelIdx + 1, _sugItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSugSelIdx(Math.max(_sugSelIdx - 1, -1));
        break;
      case "Enter":
        if (_sugSelIdx >= 0) { e.preventDefault(); e.stopPropagation(); acceptSuggestion(_sugSelIdx); }
        break;
      case "Tab":
        if (_sugItems.length) {
          e.preventDefault(); e.stopPropagation();
          acceptSuggestion(_sugSelIdx >= 0 ? _sugSelIdx : 0);
        }
        break;
      case "Escape":
        if (_sugDropdown) { e.preventDefault(); hideSuggestDropdown(); }
        break;
    }
  };
}

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
  hideSuggestDropdown();
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

  var accentColor = (platform && platform.color) ? platform.color : "#4f9437";
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

        // Read current input text
        var text = (input.tagName === "TEXTAREA" || input.tagName === "INPUT")
          ? (input.value || "")
          : (input.innerText || input.textContent || "");
        text = text.trim();

        // Minimum length check
        if (text.length < 4) { hideSuggestDropdown(); hideSearchingIndicator(); return; }

        // ── Extract keyword query ─────────────────────────────────────────────
        var STOP = new Set(["what","this","that","with","have","from","they","will","been","were","when","your","more","also","some","than","then","which","about","into","their","there","would","could","should","these","those","other","after","before","first","over","under","just","like","make","only","know","take","where","does","dont","how","why","can","the","and","for","are","but","not","you","all","any","its","use","was","had","has","her","him","his","she","may","our","out","who","did","get","let","new","now","per","put","see","set","two","way","yet"]);
        var lastSentence = text.split(/[.!?\n]/).filter(Boolean).pop() || text;
        var words = lastSentence.split(/\s+/).filter(function(w) {
          return w.length >= 3 && !STOP.has(w.toLowerCase().replace(/[^a-z]/g, ""));
        });
        var query;
        if (words.length >= 1) {
          query = words.slice(-5).join(" ");
        } else {
          var raw = text.split(/\s+/).filter(Boolean);
          if (raw.length < 2) { hideSuggestDropdown(); return; }
          query = raw.slice(-4).join(" ");
        }

        // ── Recents (instant — no network) ────────────────────────────────────
        var recents = matchingRecents(query);

        // ── LRU cache check (instant — no debounce delay) ─────────────────────
        var cacheKey = query.toLowerCase();
        var cached   = _ctxSuggestCache.get(cacheKey);
        if (cached !== null) {
          hideSearchingIndicator();
          renderSuggestDropdown(recents, cached, input, accentColor);
          return;
        }

        // Show recents immediately while waiting for the network
        if (recents.length) renderSuggestDropdown(recents, [], input, accentColor);

        // Deduplicate in-flight requests for the same query
        if (query === _lastSuggestedQuery) return;
        _lastSuggestedQuery = query;

        // ── Network request (cancelled on next keystroke via abortId) ─────────
        var abortId = ++_searchAbortId;
        showSearchingIndicator(accentColor);
        try {
          var data    = await sendMessage("SEARCH_MEMORY", { query: query, limit: 5 });
          if (abortId !== _searchAbortId || !_autoSuggestOn) return;
          var results = Array.isArray(data) ? data : (data.results || []);
          _ctxSuggestCache.set(cacheKey, results);   // prime LRU for next time
          hideSearchingIndicator();
          renderSuggestDropdown(recents, results, input, accentColor);
        } catch (e) {
          if (abortId === _searchAbortId) {
            hideSearchingIndicator();
            // Graceful degradation: keep showing recents, never show an error
            if (!recents.length) hideSuggestDropdown();
          }
        }
      }, 150); // 150 ms debounce (was 1800 ms)
    };
  }

  function bindInput(input) {
    if (!input || watched.has(input)) return false;
    watched.add(input);

    var onType    = buildTypingHandler(input);
    var onKeyDown = buildKeydownHandler();

    input.addEventListener("input", onType);
    input.addEventListener("compositionend", onType);
    // capture phase so we intercept ArrowDown/Tab before the host site handles them
    input.addEventListener("keydown", onKeyDown, true);
    // Save typed text as a recent prompt when user leaves the field
    input.addEventListener("blur", function() {
      var txt = (input.tagName === "TEXTAREA" || input.tagName === "INPUT")
        ? (input.value || "")
        : (input.innerText || input.textContent || "");
      saveRecentPrompt(txt.trim());
      // Delay so dropdown item mousedown fires before the close
      setTimeout(hideSuggestDropdown, 200);
    });

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
    "position:fixed", "bottom:90px", "right:20px", "z-index:2147483640",
    "background:#eef3e7", "border:1px solid " + (accentColor || "#4f9437") + "44",
    "border-left:3px solid " + (accentColor || "#4f9437"),
    "border-radius:20px", "padding:6px 12px",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "font-size:11px", "color:rgba(45, 70, 35,0.55)",
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
    "position:fixed", "bottom:90px", "right:20px", "z-index:2147483640",
    "background:#eef3e7", "border:1px solid " + accentColor + "44",
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
      '<span style="font-size:11px;font-weight:700;color:#2f6b34;flex:1">' + escapeHtml(label) + '</span>' +
      '<button id="ctx-toast-close" style="background:none;border:none;color:rgba(45, 70, 35,0.35);cursor:pointer;font-size:16px;line-height:1;padding:0">×</button>' +
    '</div>';

  // Memory rows
  var rows = shown.map(function(mem, idx) {
    var title   = (mem.title || "Untitled").slice(0, 48);
    var preview = (mem.content || "").slice(0, 70);
    if ((mem.content || "").length > 70) preview += "…";
    return (
      '<div style="' +
        'background:rgba(45, 70, 35,0.04);border:1px solid rgba(45, 70, 35, 0.32);' +
        'border-radius:8px;padding:8px 10px;' +
        (idx < shown.length - 1 ? 'margin-bottom:6px;' : '') +
      '">' +
        '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:11px;font-weight:700;color:#1c2e1d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(title) + '</div>' +
            '<div style="font-size:10px;color:rgba(45, 70, 35,0.38);line-height:1.4;margin-top:2px">' + escapeHtml(preview) + '</div>' +
          '</div>' +
        '</div>' +
        '<button class="ctx-inject-memory-btn" data-idx="' + idx + '" style="' +
          'width:100%;background:' + accentColor + ';border:none;border-radius:6px;' +
          'color:#1c2e1d;font-size:10px;font-weight:700;padding:5px 8px;cursor:pointer;' +
          'text-align:center' +
        '">⚡ Inject this memory</button>' +
      '</div>'
    );
  }).join("");

  // View all link
  var footer =
    '<div style="text-align:center;margin-top:8px">' +
      '<button id="ctx-toast-view" style="background:none;border:none;color:rgba(45, 70, 35,0.35);font-size:10px;font-weight:600;cursor:pointer;padding:0">View all memories →</button>' +
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

      var _boot = function() { if (!platform.generic) bootExtension(platform); };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", _boot);
      } else {
        _boot();
      }
    });

    // Allow popup / background to send commands to the content script
    chrome.runtime.onMessage.addListener(function(msg, _sender, sendResponse) {
      if (msg && msg.type === "INJECT_TEXT") {
        injectIntoInput(msg.text || "");
        sendResponse({ ok: true });
      }
      if (msg && msg.type === "OPEN_PANEL_WITH_SELECTION") {
        // Right-click "Open Movable Brain" — open FAB panel with text prefilled.
        // User edits and saves manually; nothing is auto-saved here.
        var selText  = msg.text  || "";
        var selTitle = msg.title || document.title;
        _saveTabInited = false; // allow initSaveTab to run fresh
        if (!document.getElementById("ctx-fab")) injectFAB(getPlatform()); // lazy on normal sites
        if (_openPanelFn) _openPanelFn();
        if (_switchTabFn) _switchTabFn("save"); // triggers initSaveTab (sync)
        // Override whatever initSaveTab filled in
        var ti = document.getElementById("ctx-save-title");
        var ci = document.getElementById("ctx-save-content");
        if (ti) ti.value = selTitle.slice(0, 120);
        if (ci) ci.value = selText;
        sendResponse({ ok: true });
      }
      return false;
    });

    chrome.storage.onChanged.addListener(function(changes, area) {
      // Bust memory cache when extension saves a memory (lastSave stamped by background.js)
      if (area === "local" && changes.lastSave) {
        _panelMemCache = null;
        var memTab = document.getElementById("ctx-tc-memories");
        if (memTab && memTab.classList.contains("ctx-active")) {
          loadPanelMemories();
        }
        return;
      }
      if (area !== "sync" || !changes.suggestEnabled) return;
      _suggestEnabled = changes.suggestEnabled.newValue === true;
      _autoSuggestOn = _suggestEnabled;
      var chk = document.getElementById("ctx-suggest-chk");
      if (chk) chk.checked = _suggestEnabled;
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
    var _fb = function() { if (!platform.generic) injectFAB(platform); };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", _fb);
    } else {
      _fb();
    }
  }
}

init();

// ── Lightweight status notifications (additive — does not alter existing flows) ─
// Save → show status → disappear. Compact, non-blocking, white + green theme.
var _ctxToastEl = null, _ctxToastTimer = null, _ctxOfflineActive = false;

function _ctxToastCSS() {
  if (document.getElementById("ctx-status-toast-css")) return;
  var st = document.createElement("style");
  st.id = "ctx-status-toast-css";
  st.textContent =
    "#ctx-status-toast{position:fixed;right:16px;bottom:60px;z-index:2147483647;" +
    "display:flex;align-items:center;gap:6px;max-width:200px;padding:5px 9px;" +
    "border-radius:9px;background:rgba(255,255,255,0.92);border:1px solid rgba(79,148,55,0.18);" +
    "box-shadow:0 3px 12px rgba(45,80,35,0.12);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);" +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
    "font-size:11px;font-weight:600;color:rgba(28,46,29,0.85);line-height:1.15;" +
    "opacity:0;transform:translateY(5px);transition:opacity .18s ease,transform .18s ease}" +
    "#ctx-status-toast.ctx-st-show{opacity:0.95;transform:translateY(0)}" +
    "#ctx-status-toast .ctx-st-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}" +
    "#ctx-status-toast .ctx-st-spin{display:inline-block;width:11px;height:11px;border-radius:50%;" +
    "border:2px solid rgba(79,148,55,0.25);border-top-color:#4f9437;" +
    "animation:ctxSpin .7s linear infinite;flex-shrink:0}" +
    "#ctx-status-toast .ctx-st-btn{margin-left:2px;border:none;border-radius:7px;cursor:pointer;" +
    "font-family:inherit;font-size:10px;font-weight:700;padding:3px 8px;white-space:nowrap;" +
    "background:linear-gradient(135deg,#4f9437,#5fa83f);color:#fff}" +
    "#ctx-status-toast .ctx-st-btn:hover{opacity:.9}";
  (document.head || document.documentElement).appendChild(st);
}

function _ctxDismissToast() {
  if (_ctxToastTimer) { clearTimeout(_ctxToastTimer); _ctxToastTimer = null; }
  var el = _ctxToastEl;
  if (!el) return;
  _ctxToastEl = null;
  el.classList.remove("ctx-st-show");
  setTimeout(function(){ if (el && el.parentNode) el.parentNode.removeChild(el); }, 280);
}

function ctxStatusToast(state, opts) {
  opts = opts || {};
  try { _ctxToastCSS(); } catch(_) { return; }
  if (_ctxToastTimer) { clearTimeout(_ctxToastTimer); _ctxToastTimer = null; }

  var cfg = ({
    saving:  { lead:'<span class="ctx-st-spin"></span>', text:"Saving…", ttl:0 },
    saved:   { lead:'<span>🧠</span>',         text:"Saved",        ttl:1400 },
    error:   { lead:'<span class="ctx-st-dot" style="background:#dc2626"></span>', text:"Failed", ttl:4000, btn:"Retry" },
    offline: { lead:'<span class="ctx-st-dot" style="background:#9aa39a"></span>', text:"Offline", ttl:0 },
    signin:  { lead:'<span class="ctx-st-dot" style="background:#4f9437"></span>', text:"Sign in required", ttl:5000, btn:"Sign In" },
    limit:   { lead:'<span class="ctx-st-dot" style="background:#b45309"></span>', text:"Limit reached", ttl:5000, btn:"Upgrade" }
  })[state];
  if (!cfg) return;

  if (!_ctxToastEl) {
    _ctxToastEl = document.createElement("div");
    _ctxToastEl.id = "ctx-status-toast";
    (document.body || document.documentElement).appendChild(_ctxToastEl);
  }
  var el = _ctxToastEl;
  el.innerHTML = cfg.lead + '<span class="ctx-st-text">' + cfg.text + '</span>' +
    (cfg.btn ? '<button class="ctx-st-btn">' + cfg.btn + '</button>' : '');
  requestAnimationFrame(function(){ if (_ctxToastEl === el) el.classList.add("ctx-st-show"); });

  var btn = el.querySelector(".ctx-st-btn");
  if (btn) {
    btn.onclick = function(e){
      e.stopPropagation();
      if (state === "error" && typeof opts.retry === "function") { _ctxDismissToast(); opts.retry(); }
      else if (state === "signin") { getWebAppUrl("/sign-in").then(function(u){ window.open(u, "_blank"); }); _ctxDismissToast(); }
      else if (state === "limit")  { getWebAppUrl("/pricing").then(function(u){ window.open(u, "_blank"); }); _ctxDismissToast(); }
    };
  }

  if (state === "offline") {
    _ctxOfflineActive = true;
    var onBack = function(){ window.removeEventListener("online", onBack); if (_ctxOfflineActive){ _ctxOfflineActive = false; _ctxDismissToast(); } };
    window.addEventListener("online", onBack);
  } else {
    _ctxOfflineActive = false;
  }

  if (cfg.ttl > 0) _ctxToastTimer = setTimeout(_ctxDismissToast, cfg.ttl);
}

function ctxIsAuthError(err) {
  var m = ((err && (err.message || err)) || "").toString().toLowerCase();
  return /401|403|unauthor|not connected|sign[\s-]?in|no api key|invalid.*key|\btoken\b/.test(m);
}

// ── Floating-brain state synchronization (additive, event-driven) ──────────────
// Keeps the floating brain in sync with the latest saved context, plan/limit, and
// sign-in state — without polling and without altering existing flows.
// Triggers come from signals the background already emits:
//   • storage.local.lastSave  → stamped after EVERY successful save (all paths/tabs)
//   • storage.sync.apiKey/apiUrl → changes when sign-in / connection changes
var _ctxSyncCooldown = null;
function ctxBrainSync() {
  if (_ctxSyncCooldown) return;        // coalesce bursts (leading-edge), keep CPU minimal
  _ctxSyncCooldown = setTimeout(function () { _ctxSyncCooldown = null; }, 120);
  try {
    // Invalidate caches so nothing renders stale.
    _panelMemCache = null;
    _panelProjCache = null;

    // Live-refresh the floating panel if it's open (only the visible tab).
    var panel = document.getElementById("ctx-panel");
    if (panel && panel.classList.contains("ctx-open")) {
      if (_activeTab === "memories" && typeof loadPanelMemories === "function") loadPanelMemories();
      else if (_activeTab === "projects" && typeof loadPanelProjects === "function") loadPanelProjects();
    }

    // Live-refresh the sidebar if it's open (preserve the user's current query).
    var sb = document.getElementById("ctx-sidebar");
    if (sb && sb.classList.contains("ctx-sidebar-open") && typeof loadMemories === "function") {
      var qi = document.getElementById("ctx-search-input");
      loadMemories(qi && qi.value ? qi.value : "");
    }
  } catch (_) {}
}

try {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (!changes) return;
      // New save (selection / drag / right-click / quick-save) — same tab or other tabs.
      if (area === "local" && changes.lastSave) { ctxBrainSync(); return; }
      // Sign-in / connection change → reflect immediately.
      if (area === "sync" && (changes.apiKey || changes.apiUrl)) { ctxBrainSync(); }
    });
  }
} catch (_) {}
