// ── Live Session module · polls + live vote tallies ──────────────────────────
// Subscribes to active polls and their votes. Vote aggregation happens client
// side from the votes stream, so percentages update live for everyone.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getLiveClient } from "../lib/supabaseClient";
import { TABLES, POLL_DURATION_MS } from "../config";
import { getUserSessionId } from "../lib/userSession";
import type { LivePoll, PollTally } from "../types";

interface PollRow {
  id: string;
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
  question: r.question,
  imageUrl: r.image_url,
  options: Array.isArray(r.options) ? r.options : [],
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  isActive: r.is_active,
});

export function useLivePolls(enabled: boolean) {
  const [polls, setPolls] = useState<LivePoll[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const pollChan = useRef<RealtimeChannel | null>(null);
  const voteChan = useRef<RealtimeChannel | null>(null);
  const userSessionId = getUserSessionId();

  const fetchPolls = useCallback(async () => {
    const client = getLiveClient();
    if (!client) {
      setLoading(false);
      return;
    }
    const { data: pollData } = await client
      .from(TABLES.polls)
      .select("*")
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
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
        // Apply vote deltas incrementally to avoid a full refetch per vote.
        const row = (payload.new ?? payload.old) as VoteRow;
        if (!row) return;
        setVotes((prev) => {
          const without = prev.filter(
            (v) => !(v.poll_id === row.poll_id && v.user_session_id === row.user_session_id),
          );
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

  /** poll.id -> tally */
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

  /** poll.id -> this user's selected option (or undefined). */
  const myVotes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of votes) if (v.user_session_id === userSessionId) map[v.poll_id] = v.selected_option;
    return map;
  }, [votes, userSessionId]);

  /** Cast a vote. The DB composite PK guarantees one vote per user per poll. */
  const vote = useCallback(async (pollId: string, optionIndex: number) => {
    if (myVotes[pollId] !== undefined) return;       // already voted
    const client = getLiveClient();
    if (!client) return;
    // Optimistic local update for instant feedback.
    setVotes((prev) => [...prev, { poll_id: pollId, user_session_id: userSessionId, selected_option: optionIndex }]);
    const { error } = await client.from(TABLES.votes).insert({
      poll_id: pollId,
      user_session_id: userSessionId,
      selected_option: optionIndex,
    });
    if (error) {
      // Roll back optimistic vote on failure (e.g. duplicate).
      setVotes((prev) => prev.filter((v) => !(v.poll_id === pollId && v.user_session_id === userSessionId)));
    }
  }, [myVotes, userSessionId]);

  /** Admin: create a 24-hour poll. */
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
  }, [fetchPolls]);

  return { polls, tallies, myVotes, loading, vote, createPoll };
}
