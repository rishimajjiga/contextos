// ── Live Session module · error message extraction ───────────────────────────
// Supabase/PostgREST errors are plain objects ({ message, details, hint, code }),
// not Error instances — so `e instanceof Error` misses them and the UI shows a
// useless generic string. This pulls out the real, actionable message.

export function errMessage(e: unknown, fallback = "Something went wrong."): string {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const msg =
      (typeof o.message === "string" && o.message) ||
      (typeof o.error_description === "string" && o.error_description) ||
      (typeof o.error === "string" && o.error) ||
      (typeof o.hint === "string" && o.hint) ||
      (typeof o.details === "string" && o.details);
    if (msg) {
      const code = typeof o.code === "string" && o.code ? ` [${o.code}]` : "";
      return `${msg}${code}`;
    }
    try { return JSON.stringify(e); } catch { /* ignore */ }
  }
  return fallback;
}
