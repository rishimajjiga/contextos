// ── Live Session module · chat messages ──────────────────────────────────────
// Loads the last 100 messages for the active session and subscribes to inserts.
// Memory is hard-capped at MAX_MESSAGES so thousands of users stay light.

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
    setMessages([]);
    if (!sessionId) return;
    const client = getLiveClient();
    if (!client) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      // Newest 100, then reverse to chronological order for rendering.
      const { data } = await client
        .from(TABLES.messages)
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(MAX_MESSAGES);
      if (cancelled) return;
      const rows = (data ?? []) as Row[];
      setMessages(rows.map(toMsg).reverse());
      setLoading(false);
    })();

    // Subscribe to inserts for THIS session only.
    const ch = client
      .channel(`live:messages:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: TABLES.messages,
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const m = toMsg(payload.new as Row);
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;        // de-dupe
            const next = [...prev, m];
            return next.length > MAX_MESSAGES
              ? next.slice(next.length - MAX_MESSAGES)               // cap memory
              : next;
          });
        },
      )
      .subscribe();
    channelRef.current = ch;

    return () => {
      cancelled = true;
      client.removeChannel(ch);
      channelRef.current = null;
    };
  }, [sessionId]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) return;
    const client = getLiveClient();
    if (!client) return;
    await client.from(TABLES.messages).insert({
      session_id: sessionId,
      text: trimmed.slice(0, 2000),
      user_session_id: userSessionId,
    });
    // No optimistic push needed — the realtime INSERT echoes back to us.
  }, [sessionId, userSessionId]);

  return { messages, loading, sendMessage, userSessionId };
}
