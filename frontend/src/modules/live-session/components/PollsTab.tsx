// ── Live Session module · polls tab ──────────────────────────────────────────
import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, Check, Plus, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLivePolls } from "../hooks/useLivePolls";
import { useCountdown } from "../hooks/useCountdown";
import { useIsAdmin } from "../hooks/useIsAdmin";
import type { LivePoll, PollTally } from "../types";

interface Props {
  open: boolean;
  isAdmin: boolean;
}

export function PollsTab({ open, isAdmin }: Props) {
  const { email } = useIsAdmin();
  const { polls, tallies, myVotes, loading, vote, createPoll } = useLivePolls(open);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {isAdmin && (
        <div className="flex justify-end border-b border-border/60 px-5 py-2">
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600"
          >
            {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showCreate ? "Cancel" : "New poll"}
          </button>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {isAdmin && showCreate && (
          <AdminCreatePoll
            onCreate={async (q, opts, img) => {
              await createPoll(q, opts, img, email ?? "admin");
              setShowCreate(false);
            }}
          />
        )}

        {loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Loading polls…</p>
        ) : polls.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No active polls</p>
            <p className="text-xs text-muted-foreground">New polls from the team appear here live.</p>
          </div>
        ) : (
          polls.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              tally={tallies[p.id] ?? { counts: p.options.map(() => 0), total: 0 }}
              myVote={myVotes[p.id]}
              onVote={(idx) => vote(p.id, idx)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PollCard({
  poll,
  tally,
  myVote,
  onVote,
}: {
  poll: LivePoll;
  tally: PollTally;
  myVote?: number;
  onVote: (i: number) => void;
}) {
  const { label, ended } = useCountdown(poll.expiresAt);
  const voted = myVote !== undefined;
  const locked = voted || ended;

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-snug">{poll.question}</p>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums ${
            ended ? "bg-muted text-muted-foreground" : "bg-brand-500/10 text-brand-700"
          }`}
        >
          <Clock className="h-3 w-3" />
          {ended ? "Closed" : label}
        </span>
      </div>

      {poll.imageUrl && (
        <img
          src={poll.imageUrl}
          alt=""
          loading="lazy"
          className="mb-3 max-h-44 w-full rounded-xl object-cover"
        />
      )}

      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const count = tally.counts[i] ?? 0;
          const pct = tally.total ? Math.round((count / tally.total) * 100) : 0;
          const chosen = myVote === i;
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => onVote(i)}
              className={`relative w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                chosen ? "border-brand-500" : "border-border"
              } ${locked ? "cursor-default" : "hover:border-brand-400"}`}
            >
              {/* Animated result bar */}
              {locked && (
                <motion.div
                  className={`absolute inset-y-0 left-0 ${chosen ? "bg-brand-500/20" : "bg-surface-3/70"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  {chosen && <Check className="h-3.5 w-3.5 text-brand-600" />}
                  {opt}
                </span>
                {locked && <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {tally.total} {tally.total === 1 ? "vote" : "votes"}
        {voted && !ended && " · you voted"}
      </p>
    </div>
  );
}

// Admin-only poll creator.
function AdminCreatePoll({
  onCreate,
}: {
  onCreate: (q: string, opts: string[], img: string | null) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const clean = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim() && clean.length >= 2;

  return (
    <div className="space-y-2 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
      <p className="text-xs font-medium text-brand-700">Admin · new poll (24h)</p>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Poll question…"
        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
      />
      {options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={o}
            onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={`Option ${i + 1}`}
            className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
          />
          {options.length > 2 && (
            <button
              onClick={() => setOptions((p) => p.filter((_, j) => j !== i))}
              className="rounded-lg px-2 text-muted-foreground hover:text-destructive"
              aria-label="Remove option"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <button
          onClick={() => setOptions((p) => [...p, ""])}
          className="text-xs font-medium text-brand-700 hover:text-brand-600"
        >
          + Add option
        </button>
      )}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          className="h-9 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <Button
        size="sm"
        className="w-full"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          try { await onCreate(question.trim(), clean, imageUrl.trim() || null); }
          finally { setBusy(false); }
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Publish poll
      </Button>
    </div>
  );
}
