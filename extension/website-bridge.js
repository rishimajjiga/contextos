// ContextOS Extension — Website Bridge
// Injected into ContextOS web app pages in the MAIN JavaScript world.
// Goal: if the user is signed into the website but the extension has no API key,
// automatically create one using the Clerk JWT so the extension connects itself.
//
// This runs on: localhost:5173, localhost:5174, app.contextos.dev
// World: MAIN (can access window.Clerk)

(async function () {
  "use strict";

  // Wait for Clerk to initialize — it loads asynchronously after the page
  let attempts = 0;
  while (!window.Clerk?.session && attempts < 50) {
    await new Promise((r) => setTimeout(r, 200));
    attempts++;
  }

  const session = window.Clerk?.session;
  if (!session) return; // User not signed in, or Clerk not present

  // Get a fresh JWT from the active Clerk session
  let token;
  try {
    token = await session.getToken();
  } catch (_) {
    return;
  }
  if (!token) return;

  // Read the backend API URL that main.tsx exposed via a data attribute
  const apiUrl =
    document.documentElement.dataset.ctxosApiUrl ||
    (["5173", "5174"].includes(window.location.port)
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : window.location.origin);

  // Tell background.js to create an API key using this token (if not already set)
  try {
    chrome.runtime.sendMessage(
      { type: "STORE_CLERK_TOKEN", token, apiUrl },
      (resp) => {
        if (chrome.runtime.lastError) return; // Extension not installed / inactive
        if (resp?.saved) {
          console.log("[ContextOS] Extension auto-connected via Clerk session.");
        }
      }
    );
  } catch (_) {
    // chrome.runtime not available — extension not installed
  }
})();

// ── Bidirectional sync ────────────────────────────────────────────────────────
// 1. When the extension saves a memory, background.js sets chrome.storage.local.lastSave.
//    We watch for that change here and dispatch a DOM event so React can refetch.
// 2. When the website saves a memory it dispatches contextos:memory-saved on window.
//    We forward that to background.js so it can invalidate its cache.

(function attachSyncListeners() {
  // Extension → Website: storage stamp → DOM event
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.lastSave) {
        window.dispatchEvent(new CustomEvent("contextos:memory-saved"));
      }
    });
  }

  // Website → Extension: DOM event → background cache invalidation
  window.addEventListener("contextos:memory-saved", () => {
    try {
      chrome.runtime.sendMessage({ type: "INVALIDATE_CACHE" }, () => {
        if (chrome.runtime.lastError) { /* extension not active */ }
      });
    } catch (_) {}
  });
})();
