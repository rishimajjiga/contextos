// ── Live Session module · polls + live vote tallies ──────────────────────────
// Polls are INDEPENDENT of the chat session: each runs a fixed 24h voting
// window and its results stay visible for a grace period after it ends. Ending
// or deleting a session does NOT affect polls.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getLiveClient } from "../lib/supabaseClient";
import { TABLES, POLL_DURATION_MS, POLL_RESULT_GRACE_MS } from "../config";
import { getUserSessionId } from "../lib/userSession";
import type { LivePoll, PollTally } from "../types";

interface PollRow {
  id: string;
  session_id: string | null;
  question: string;
  image_url: string | null;
  options: string[];
  created_at: string;
  expires_at: string;
  is_active: boolean;
}
interface VoteRow {
  poll_id: string;
  user_session_id: string;
  selected_option: number;
}

const toPoll = (r: PollRow): LivePoll => ({
  id: r.id,
  sessionId: r.session_id ?? "",
  question: r.question,
  imageUrl: r.image_url,
  options: Array.isArray(r.options) ? r.options : [],
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  isActive: r.is_active,
});

export function useLivePolls(enabled: boolean, sessionId: string | null) {
  const [polls, setPolls] = useState<LivePoll[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const pollChan = useRef<RealtimeChannel | null>(null);
  const voteChan = useRef<RealtimeChannel | null>(null);
  const userSessionId = getUserSessionId();

  const fetchPolls = useCallback(async () => {
    const client = getLiveClient();
    if (!client) { setLoading(false); return; }
    // Show polls still in their voting window OR ended within the results grace.
    const cutoff = new Date(Date.now() - POLL_RESULT_GRACE_MS).toISOString();
    const { data: pollData } = await client
      .from(TABLES.polls)
      .select("*")
      .gt("expires_at", cutoff)               // active + recently-ended polls
      .order("created_at", { ascending: false });
    const ps = (pollData ?? []) as PollRow[];
    setPolls(ps.map(toPoll));

    if (ps.length) {
      const { data: voteData } = await client
        .from(TABLES.votes)
        .select("poll_id,user_session_id,selected_option")
        .in("poll_id", ps.map((p) => p.id));
      setVotes((voteData ?? []) as VoteRow[]);
    } else {
      setVotes([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const client = getLiveClient();
    if (!client) return;

    fetchPolls();

    pollChan.current = client
      .channel("live:polls")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.polls }, () => fetchPolls())
      .subscribe();

    voteChan.current = client
      .channel("live:votes")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.votes }, (payload) => {
        const row = (payload.new ?? payload.old) as VoteRow;
        if (!row) return;
        setVotes((prev) => {
          const without = prev.filter(
            (v) => !(v.poll_id === row.poll_id && v.user_session_id === row.user_session_id));
          return payload.eventType === "DELETE" ? without : [...without, payload.new as VoteRow];
        });
      })
      .subscribe();

    return () => {
      if (pollChan.current) client.removeChannel(pollChan.current);
      if (voteChan.current) client.removeChannel(voteChan.current);
      pollChan.current = null;
      voteChan.current = null;
    };
  }, [enabled, fetchPolls]);

  const tallies = useMemo(() => {
    const map: Record<string, PollTally> = {};
    for (const p of polls) map[p.id] = { counts: p.options.map(() => 0), total: 0 };
    for (const v of votes) {
      const t = map[v.poll_id];
      if (t && v.selected_option >= 0 && v.selected_option < t.counts.length) {
        t.counts[v.selected_option] += 1;
        t.total += 1;
      }
    }
    return map;
  }, [polls, votes]);

  const myVotes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of votes) if (v.user_session_id === userSessionId) map[v.poll_id] = v.selected_option;
    return map;
  }, [votes, userSessionId]);

  /** Cast a vote. DB composite PK guarantees one vote per user per poll. */
  const vote = useCallback(async (pollId: string, optionIndex: number) => {
    if (myVotes[pollId] !== undefined) return;
    const client = getLiveClient();
    if (!client) return;
    setVotes((prev) => [...prev, { poll_id: pollId, user_session_id: userSessionId, selected_option: optionIndex }]);
    const { error } = await client.from(TABLES.votes).insert({
      poll_id: pollId, user_session_id: userSessionId, selected_option: optionIndex,
    });
    if (error) {
      setVotes((prev) => prev.filter((v) => !(v.poll_id === pollId && v.user_session_id === userSessionId)));
    }
  }, [myVotes, userSessionId]);

  /**
   * Admin: create a poll with a fixed 24h voting window (independent of any
   * session). `imageUrl` is the already-uploaded signed URL (or null).
   * `sessionId` is recorded for reference only. Throws on failure.
   */
  const createPoll = useCallback(async (
    question: string,
    options: string[],
    imageUrl: string | null,
    adminEmail: string,
  ) => {
    const client = getLiveClient();
    if (!client) throw new Error("Live session backend not configured.");
    const now = new Date();
    const { error } = await client.from(TABLES.polls).insert({
      session_id: sessionId,                       // reference only; may be null
      question,
      options,
      image_url: imageUrl,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + POLL_DURATION_MS).toISOString(),
      is_active: true,
      created_by: adminEmail,
    });
    if (error) throw error;
    await fetchPolls();
  }, [sessionId, fetchPolls]);

  return { polls, tallies, myVotes, loading, vote, createPoll };
}
