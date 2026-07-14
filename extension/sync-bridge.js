// ContextOS Extension — Sync Bridge (ISOLATED world)
// website-bridge.js runs in the MAIN world (required for window.Clerk), where
// chrome.storage / chrome.runtime are unavailable — so its sync listeners
// never fire. This script is the working transport, running in the default
// isolated world where extension APIs exist:
//
//   Extension save → chrome.storage.local.lastSave changes → DOM event
//                    "contextos:memory-saved" → React (useMemories) refetches
//   Website save   → React dispatches the same DOM event → INVALIDATE_CACHE
//                    → background cache cleared + lastSave stamped → the
//                    floating widget refreshes too
(function () {
  "use strict";
  var EVT = "contextos:memory-saved";

  // Extension → Website: storage stamp → DOM event the React app listens for
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes.lastSave) {
        window.dispatchEvent(new CustomEvent(EVT, { detail: { source: "extension" } }));
      }
    });
  } catch (_) {}

  // Website → Extension: DOM event → background cache invalidation.
  // Skip events we dispatched ourselves (detail.source === "extension").
  window.addEventListener(EVT, function (e) {
    if (e && e.detail && e.detail.source === "extension") return;
    try {
      chrome.runtime.sendMessage({ type: "INVALIDATE_CACHE" }, function () {
        if (chrome.runtime.lastError) { /* extension inactive — ignore */ }
      });
    } catch (_) {}
  });
})();
