// ── Live Session module · share helpers ──────────────────────────────────────
import { LIVE_SHARE_PARAM, POLL_SHARE_PARAM } from "../config";

function origin(): string {
  try { return window.location.origin; } catch { return "https://www.usecontextos.com"; }
}

/** Invite URL that auto-opens the Live panel for whoever clicks it. */
export function liveInviteUrl(): string {
  return `${origin()}/?${LIVE_SHARE_PARAM}=1`;
}

/** Link that opens the Polls tab focused on a specific poll. */
export function pollShareUrl(pollId: string): string {
  return `${origin()}/?${LIVE_SHARE_PARAM}=1&${POLL_SHARE_PARAM}=${encodeURIComponent(pollId)}`;
}

/** wa.me share link with a prefilled message (opens WhatsApp chat picker). */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
