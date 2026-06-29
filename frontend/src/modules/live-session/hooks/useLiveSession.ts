// ── Live Session module · active-session subscription ────────────────────────
// Subscribes ONLY to the single active session row. Unsubscribes on disable
// (panel close) so no listeners leak.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getLiveClient } from "../lib/supabaseClient";
import { TABLES, SESSION_DURATION_MS } from "../config";
import type { LiveSession } from "../types";

interface Row {
  id: string;
  topic: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_by: string | null;
}

function toSession(r: Row): LiveSession {
  return {
    id: r.id,
    topic: r.topic,
    startTime: r.start_time,
    endTime: r.end_time,
    isActive: r.is_active,
    createdBy: r.created_by,
  };
}

export function useLiveSession(enabled: boolean) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchActive = useCallback(async () => {
    const client = getLiveClient();
    if (!client) {
      setLoading(false);
      return;
    }
    const { data } = await client
      .from(TABLES.sessions)
      .select("*")
      .eq("is_active", true)
      .gt("end_time", new Date().toISOString())
      .order("start_time", { ascending: false })
      .limit(1);
    setSession(data && data[0] ? toSession(data[0] as Row) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const client = getLiveClient();
    if (!client) return;

    fetchActive();

    // Refetch on any change to the sessions table (rows are few).
    const ch = client
      .channel("live:sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLES.sessions },
        () => fetchActive(),
      )
      .subscribe();
    channelRef.current = ch;

    return () => {
      client.removeChannel(ch);
      channelRef.current = null;
    };
  }, [enabled, fetchActive]);

  /** Admin: create a new 1-hour session, deactivating any prior ones. */
  const createSession = useCallback(async (topic: string, adminEmail: string) => {
    const client = getLiveClient();
    if (!client) throw new Error("Live session backend not configured.");
    const now = new Date();
    const end = new Date(now.getTime() + SESSION_DURATION_MS);
    // Deactivate existing active sessions first (single live session at a time).
    await client.from(TABLES.sessions).update({ is_active: false }).eq("is_active", true);
    const { error } = await client.from(TABLES.sessions).insert({
      topic,
      start_time: now.toISOString(),
      end_time: end.toISOString(),
      is_active: true,
      created_by: adminEmail,
    });
    if (error) throw error;
    await fetchActive();
  }, [fetchActive]);

  /** Admin: end the current session now. */
  const endSession = useCallback(async (id: string) => {
    const client = getLiveClient();
    if (!client) return;
    await client.from(TABLES.sessions).update({ is_active: false }).eq("id", id);
    await fetchActive();
  }, [fetchActive]);

  return { session, loading, createSession, endSession };
}
