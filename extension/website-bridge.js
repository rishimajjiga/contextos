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
