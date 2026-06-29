// ── Live Session module · share helpers ──────────────────────────────────────
import { LIVE_SHARE_PARAM } from "../config";

/** Invite URL that auto-opens the Live panel for whoever clicks it. */
export function liveInviteUrl(): string {
  try {
    return `${window.location.origin}/?${LIVE_SHARE_PARAM}=1`;
  } catch {
    return "https://www.usecontextos.com/?live=1";
  }
}

/** wa.me share link with a prefilled message (opens WhatsApp chat picker). */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
