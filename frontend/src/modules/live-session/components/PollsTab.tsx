// ── Live Session module · polls tab (session-scoped, image upload) ───────────
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Check, Plus, X, ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLivePolls } from "../hooks/useLivePolls";
import { useCountdown } from "../hooks/useCountdown";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { uploadPollImage } from "../lib/storage";
import { errMessage } from "../lib/errors";
import type { LivePoll, LiveSession, PollTally } from "../types";

interface Props {
  open: boolean;
  isAdmin: boolean;
  session: LiveSession | null;
}

export function PollsTab({ open, isAdmin, session }: Props) {
  const { email } = useIsAdmin();
  const sessionId = session?.id ?? null;
  const { polls, tallies, myVotes, loading, vote, createPoll } = useLivePolls(open && !!sessionId, sessionId);
  const [showCreate, setShowCreate] = useState(false);

  // Polls live inside a session. No session → nothing to show.
  if (!sessionId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm font-medium">No active session</p>
        <p className="text-xs text-muted-foreground">Polls appear once a live session is running.</p>
      </div>
    );
  }

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
        {isAdmin && showCreate && session && (
          <AdminCreatePoll
            onCreate={async (q, opts, file) => {
              const imageUrl = file ? await uploadPollImage(file) : null;
              // Tied to the session: poll expires when the session ends.
              await createPoll(q, opts, imageUrl, session.endTime, email ?? "admin");
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
  poll, tally, myVote, onVote,
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
      {/* Image ABOVE the question */}
      {poll.imageUrl && (
        <img src={poll.imageUrl} alt="" loading="lazy"
          className="mb-3 max-h-48 w-full rounded-xl object-cover" />
      )}

      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-snug">{poll.question}</p>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums ${
          ended ? "bg-muted text-muted-foreground" : "bg-brand-500/10 text-brand-700"
        }`}>
          <Clock className="h-3 w-3" />
          {ended ? "Closed" : label}
        </span>
      </div>

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
        {tally.total} {tally.total === 1 ? "vote" : "votes"}{voted && !ended && " · you voted"}
      </p>
    </div>
  );
}

// Admin-only: create a poll with an optional uploaded image (JPG/PNG/WEBP).
function AdminCreatePoll({
  onCreate,
}: {
  onCreate: (question: string, options: string[], imageFile: File | null) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const clean = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim() && clean.length >= 2;

  const pickFile = (f: File | null) => {
    setErr(null);
    if (!f) { setFile(null); setPreview(null); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setErr("Only JPG, PNG or WEBP images are allowed."); return;
    }
    if (f.size > 5 * 1024 * 1024) { setErr("Image must be under 5 MB."); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  return (
    <div className="space-y-2 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
      <p className="text-xs font-medium text-brand-700">Admin · new poll (ends with session)</p>
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
            <button onClick={() => setOptions((p) => p.filter((_, j) => j !== i))}
              className="rounded-lg px-2 text-muted-foreground hover:text-destructive" aria-label="Remove option">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <button onClick={() => setOptions((p) => [...p, ""])}
          className="text-xs font-medium text-brand-700 hover:text-brand-600">+ Add option</button>
      )}

      {/* Image upload */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="preview" className="max-h-40 w-full rounded-lg object-cover" />
          <button onClick={() => pickFile(null)}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80" aria-label="Remove image">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card py-3 text-xs text-muted-foreground hover:border-brand-400 hover:text-brand-700">
          <ImageIcon className="h-4 w-4" /> Upload image (JPG, PNG, WEBP)
        </button>
      )}

      {err && <p className="flex items-center gap-1 text-[11px] text-destructive"><AlertCircle className="h-3 w-3" /> {err}</p>}

      <Button
        size="sm"
        className="w-full"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true); setErr(null);
          try {
            await onCreate(question.trim(), clean, file);
          } catch (e: unknown) {
            setErr(errMessage(e, "Could not publish poll."));
          } finally { setBusy(false); }
        }}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {busy ? "Publishing…" : "Publish poll"}
      </Button>
    </div>
  );
}
