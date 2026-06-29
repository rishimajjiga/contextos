// ── Live Session module · isolated Supabase client ───────────────────────────
// A dedicated client instance scoped to this module. It does NOT share auth
// storage with anything else (the app uses Clerk, not Supabase Auth), and it is
// created lazily so importing the module never throws.
//
// Config resolution: env vars take precedence; if Vite hasn't injected them
// (e.g. dev server started before .env was set, or a host without the vars set)
// we fall back to the project's PUBLIC anon credentials. The anon key is
// designed to be exposed in the browser, so this fallback is safe and simply
// removes an env-loading footgun.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public, browser-safe defaults (Supabase anon key — never the service key).
const FALLBACK_URL = "https://qkjllxisllvuspidyaaf.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramxseGlzbGx2dXNwaWR5YWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNTgxNTIsImV4cCI6MjA5NjkzNDE1Mn0.qnZikaygEypAxJbtFhxA0Fkfr5t4UvwIB8zbu8n55js";

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY;

let _client: SupabaseClient | null = null;

/** True when a URL + anon key are available (always true given the fallback). */
export function isLiveConfigured(): boolean {
  return Boolean(URL && ANON_KEY);
}

/**
 * Returns the singleton client. Realtime is throttled and auth persistence
 * disabled to stay lightweight.
 */
export function getLiveClient(): SupabaseClient | null {
  if (!isLiveConfigured()) return null;
  if (!_client) {
    _client = createClient(URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return _client;
}
