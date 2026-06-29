// ── Live Session module · configuration ──────────────────────────────────────
// Centralised constants for the isolated Live Session feature. Nothing here
// touches the rest of the app.

/** Only this email may create sessions / polls (client-side admin gate). */
export const ADMIN_EMAIL = "majjigarishi291@gmail.com";

/** Keep at most this many chat messages in memory / rendered. */
export const MAX_MESSAGES = 100;

/** Session length: 1 hour. */
export const SESSION_DURATION_MS = 60 * 60 * 1000;

/** Poll lifetime: 24 hours. */
export const POLL_DURATION_MS = 24 * 60 * 60 * 1000;

/** localStorage key for the anonymous per-browser session id. */
export const USER_SESSION_KEY = "contextos.live.userSessionId";

/** Table names (namespaced — see supabase-schema.sql). */
export const TABLES = {
  sessions: "live_sessions",
  messages: "live_messages",
  polls: "live_polls",
  votes: "live_poll_votes",
} as const;
