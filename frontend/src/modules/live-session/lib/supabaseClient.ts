// ── Live Session module · isolated Supabase client ───────────────────────────
// A dedicated client instance scoped to this module. It does NOT share auth
// storage with anything else (the app uses Clerk, not Supabase Auth), and it is
// created lazily so importing the module never throws if env vars are absent.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let _client: SupabaseClient | null = null;

/** True when env vars are present and a client can be used. */
export function isLiveConfigured(): boolean {
  return Boolean(URL && ANON_KEY);
}

/**
 * Returns the singleton client, or null if the module is not configured.
 * Realtime is throttled and auth persistence disabled to stay lightweight.
 */
export function getLiveClient(): SupabaseClient | null {
  if (!isLiveConfigured()) return null;
  if (!_client) {
    _client = createClient(URL as string, ANON_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return _client;
}
