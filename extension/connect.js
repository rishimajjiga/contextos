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

    chrome.storage.sync.set({ apiKey }, () => {
      console.log("[ContextOS] API key saved via connect.js fallback.");
    });
    return true;
  }

  // Try immediately (in case hash is already set on load)
  if (tryExtractKey()) return;

  // Otherwise listen for hash changes set by the React app
  window.addEventListener("hashchange", tryExtractKey);
})();
