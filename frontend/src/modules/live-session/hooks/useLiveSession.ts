// ── Live Session module · active-session subscription ────────────────────────
// Subscribes ONLY to the single active session row. Unsubscribes on disable
// (panel close) so no listeners leak. Admin sets exact start/end timestamps;
// the session ends strictly at end_time (a timer re-checks at that moment).

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getLiveClient } from "../lib/supabaseClient";
import { TABLES } from "../config";
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
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchActive = useCallback(async () => {
    const client = getLiveClient();
    if (!client) { setLoading(false); return; }
    const nowIso = new Date().toISOString();
    const { data } = await client
      .from(TABLES.sessions)
      .select("*")
      .eq("is_active", true)
      .gt("end_time", nowIso)            // strictly respects admin end_time
      .order("start_time", { ascending: false })
      .limit(1);
    setSession(data && data[0] ? toSession(data[0] as Row) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Panel closed → clear UI state.
      setSession(null);
      return;
    }
    const client = getLiveClient();
    if (!client) return;

    fetchActive();

    const ch = client
      .channel("live:sessions")
      .on("postgres_changes",
        { event: "*", schema: "public", table: TABLES.sessions },
        () => fetchActive())
      .subscribe();
    channelRef.current = ch;

    return () => {
      client.removeChannel(ch);
      channelRef.current = null;
      if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
    };
  }, [enabled, fetchActive]);

  // When a session is active, schedule a re-check exactly at end_time so the UI
  // clears the moment the admin-defined end is reached (no event fires for time).
  useEffect(() => {
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
    if (!session) return;
    const ms = new Date(session.endTime).getTime() - Date.now();
    if (ms <= 0) { fetchActive(); return; }
    endTimerRef.current = setTimeout(() => { fetchActive(); }, ms + 500);
    return () => { if (endTimerRef.current) clearTimeout(endTimerRef.current); };
  }, [session, fetchActive]);

  /** Admin: create a session with EXACT admin-defined start/end (no auto 1h). */
  const createSession = useCallback(async (
    topic: string,
    startTimeIso: string,
    endTimeIso: string,
    adminEmail: string,
  ) => {
    const client = getLiveClient();
    if (!client) throw new Error("Live session backend not configured.");
    if (new Date(endTimeIso).getTime() <= new Date(startTimeIso).getTime()) {
      throw new Error("End time must be after start time.");
    }
    // One live session at a time — end any currently active ones first.
    await client.from(TABLES.sessions).update({ is_active: false }).eq("is_active", true);
    const { error } = await client.from(TABLES.sessions).insert({
      topic,
      start_time: startTimeIso,
      end_time: endTimeIso,
      is_active: true,
      created_by: adminEmail,
    });
    if (error) throw error;
    await fetchActive();
  }, [fetchActive]);

  /** Admin: end now — atomically deactivate session + polls and delete messages. */
  const endSession = useCallback(async (id: string) => {
    const client = getLiveClient();
    if (!client) return;
    const { error } = await client.rpc("end_live_session", { p_session_id: id });
    if (error) {
      // Fallback if the RPC isn't installed yet: at least deactivate the session.
      await client.from(TABLES.sessions).update({ is_active: false }).eq("id", id);
    }
    await fetchActive();
  }, [fetchActive]);

  return { session, loading, createSession, endSession };
}
