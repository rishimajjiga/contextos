// ── Live Session module · anonymous user identity ────────────────────────────
// Each browser gets a stable random id (no login required). Persisted in
// localStorage so a refresh keeps the same identity (and its single poll vote).

import { USER_SESSION_KEY } from "../config";

function randomId(): string {
  // Prefer crypto.randomUUID where available.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "anon-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Get (or lazily create) the anonymous per-browser session id. */
export function getUserSessionId(): string {
  try {
    let id = localStorage.getItem(USER_SESSION_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(USER_SESSION_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked → ephemeral per-tab id.
    return randomId();
  }
}
