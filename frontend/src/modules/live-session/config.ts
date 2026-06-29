// ── Live Session module · configuration ──────────────────────────────────────
// Centralised constants for the isolated Live Session feature. Nothing here
// touches the rest of the app.

/** Only this email may create sessions / polls (client-side admin gate). */
export const ADMIN_EMAIL = "majjigarishi291@gmail.com";

/** Keep at most this many chat messages in memory / rendered. */
export const MAX_MESSAGES = 100;

/** Session length: 1 hour (default; admin can override start/end). */
export const SESSION_DURATION_MS = 60 * 60 * 1000;

/** Poll voting window: 24 hours (independent of the session). */
export const POLL_DURATION_MS = 24 * 60 * 60 * 1000;

/** After a poll ends, keep showing its results for this long. */
export const POLL_RESULT_GRACE_MS = 24 * 60 * 60 * 1000;

/** localStorage key for the anonymous per-browser session id. */
export const USER_SESSION_KEY = "contextos.live.userSessionId";

/** WhatsApp community invite (Join button in the live panel). */
export const WHATSAPP_COMMUNITY_URL =
  "https://chat.whatsapp.com/GUG76KgIdNm4AxoFDlbvx3?s=sh&p=a&mlu=1";

/** URL query flag that auto-opens the Live panel (used in shared invite links). */
export const LIVE_SHARE_PARAM = "live";

/** URL query flag that opens the Polls tab to a specific poll (shared links). */
export const POLL_SHARE_PARAM = "poll";

/** Table names (namespaced — see supabase-setup-all.sql). */
export const TABLES = {
  sessions: "live_sessions",
  messages: "live_messages",
  polls: "live_polls",
  votes: "live_poll_votes",
} as const;
