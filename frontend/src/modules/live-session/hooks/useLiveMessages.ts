// ── Live Session module · chat messages (text + emoji only) ──────────────────
// Loads the last 100 messages for the active session and subscribes to inserts.
// Memory is hard-capped at MAX_MESSAGES. Insert errors are surfaced (not
// swallowed) so the UI can show why a send failed. No media fields exist.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getLiveClient } from "../lib/supabaseClient";
import { TABLES, MAX_MESSAGES } from "../config";
import { getUserSessionId } from "../lib/userSession";
import type { LiveMessage } from "../types";

interface Row {
  id: string;
  session_id: string;
  text: string;
  user_session_id: string;
  created_at: string;
}

const toMsg = (r: Row): LiveMessage => ({
  id: r.id,
  sessionId: r.session_id,
  text: r.text,
  userSessionId: r.user_session_id,
  timestamp: r.created_at,
});

export function useLiveMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userSessionId = getUserSessionId();

  useEffect(() => {
    setMessages([]);                 // clear when session changes / ends
    if (!sessionId) return;
    const client = getLiveClient();
    if (!client) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data } = await client
        .from(TABLES.messages)
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(MAX_MESSAGES);
      if (cancelled) return;
      const rows = (data ?? []) as Row[];
      setMessages(rows.map(toMsg).reverse());      // chronological
      setLoading(false);
    })();

    // Subscribe to inserts for THIS session only.
    const ch = client
      .channel(`live:messages:${sessionId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: TABLES.messages, filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const m = toMsg(payload.new as Row);
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;       // de-dupe
            const next = [...prev, m];
            return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
          });
        })
      .subscribe();
    channelRef.current = ch;

    return () => {
      cancelled = true;
      client.removeChannel(ch);
      channelRef.current = null;
    };
  }, [sessionId]);

  /**
   * Send a text/emoji message. Throws on failure so the caller can surface the
   * reason (e.g. RLS rejected because the session is not active).
   */
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) return;
    const client = getLiveClient();
    if (!client) throw new Error("Backend not configured.");
    const { error } = await client.from(TABLES.messages).insert({
      session_id: sessionId,
      text: trimmed.slice(0, 2000),       // text + emoji only; no media
      user_session_id: userSessionId,
    });
    if (error) throw error;               // realtime INSERT echoes it back to us
  }, [sessionId, userSessionId]);

  return { messages, loading, sendMessage, userSessionId };
}
