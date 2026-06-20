// ContextOS Extension — Connect Page Script
// Injected into /connect-extension by the manifest.
// Primary method: background.js reads the key from the URL hash via onUpdated.
// Fallback (this script): if the hash is already set when this runs, save it
// directly via chrome.storage (content scripts have storage access).

(function () {
  function tryExtractKey() {
    const hash = window.location.hash; // e.g. "#key=ctxos_abc123"
    const match = hash.match(/[#&]key=([^&]+)/);
    if (!match) return false;

    const apiKey = decodeURIComponent(match[1]);
    if (!apiKey.startsWith("ctxos_")) return false;

    // Derive backend API URL from the frontend URL (or from what the React app exposed)
    let apiUrl = document.documentElement.dataset.ctxosApiUrl || "";
    if (!apiUrl) {
      try {
        const u = new URL(window.location.origin);
        if (u.port === "5173" || u.port === "5174") {
          apiUrl = `${u.protocol}//${u.hostname}:8000`;
        } else {
          apiUrl = u.origin;
        }
      } catch (_) { apiUrl = "https://contextos-production-d82a.up.railway.app"; }
    }

    chrome.storage.sync.set({ apiKey, apiUrl }, () => {
      console.log("[ContextOS] API key + URL saved via connect.js fallback.");
    });
    return true;
  }

  // Try immediately (in case hash is already set on load)
  if (tryExtractKey()) return;

  // Otherwise listen for hash changes set by the React app
  window.addEventListener("hashchange", tryExtractKey);
})();
