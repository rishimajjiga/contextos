// ── Live Session module · chat tab (text + emoji only) ───────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Send, Clock, Plus, Square, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveMessages } from "../hooks/useLiveMessages";
import { useCountdown } from "../hooks/useCountdown";
import { useIsAdmin } from "../hooks/useIsAdmin";
import type { LiveSession } from "../types";
import { errMessage } from "../lib/errors";

interface Props {
  session: LiveSession | null;
  loading: boolean;
  isAdmin: boolean;
  onCreateSession: (topic: string, startIso: string, endIso: string, adminEmail: string) => Promise<void>;
  onEndSession: (id: string) => Promise<void>;
}

// Format a Date for a <input type="datetime-local"> value (local, no tz).
function toLocalInput(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function LiveTab({ session, loading, isAdmin, onCreateSession, onEndSession }: Props) {
  const { email } = useIsAdmin();
  const sessionId = session?.id ?? null;
  const { messages, sendMessage, userSessionId } = useLiveMessages(sessionId);
  const { label, ended } = useCountdown(session?.endTime);
  const [draft, setDraft] = useState("");
  const [sendErr, setSendErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || ended) return;
    const text = draft;
    setDraft("");
    setSendErr(null);
    try {
      await sendMessage(text);
    } catch (err: unknown) {
      setDraft(text); // restore so the user doesn't lose it
      setSendErr(errMessage(err, "Failed to send. Try again."));
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="rounded-full bg-brand-500/10 p-4">
          <Clock className="h-6 w-6 text-brand-600" />
        </div>
        <div>
          <p className="text-sm font-medium">No live session right now</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sessions are started by the ContextOS team. Check back soon.
          </p>
        </div>
        {isAdmin && (
          <AdminStartSession
            onCreate={(topic, startIso, endIso) => onCreateSession(topic, startIso, endIso, email ?? "admin")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{session.topic}</p>
          <p className="text-xs text-muted-foreground">Live now · anonymous chat</p>
        </div>
        <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tabular-nums ${
          ended ? "bg-destructive/10 text-destructive" : "bg-brand-500/10 text-brand-700"
        }`}>
          <Clock className="h-3.5 w-3.5" />
          {ended ? "Ended" : label}
        </div>
      </div>

      {isAdmin && !ended && (
        <div className="flex justify-end px-5 pt-2">
          <button
            onClick={() => onEndSession(session.id)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <Square className="h-3 w-3" /> End session
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No messages yet — say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.userSessionId === userSessionId;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-soft ${
                  mine ? "rounded-br-md bg-brand-500 text-white" : "rounded-bl-md bg-surface-2 text-foreground"
                }`}>
                  {!mine && (
                    <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {m.userSessionId.slice(0, 6)}
                    </span>
                  )}
                  <span className="break-words">{m.text}</span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {sendErr && (
        <div className="mx-3 mb-1 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {sendErr}
        </div>
      )}

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border/60 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={ended}
          maxLength={2000}
          placeholder={ended ? "Session ended" : "Type a message…"}
          className="h-10 flex-1 rounded-full border border-border bg-card/70 px-4 text-sm outline-none transition-colors focus:border-brand-400 disabled:opacity-60"
        />
        <Button type="submit" size="icon" disabled={ended || !draft.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

// Admin-only: create a session with EXACT start/end timestamps.
function AdminStartSession({
  onCreate,
}: {
  onCreate: (topic: string, startIso: string, endIso: string) => Promise<void>;
}) {
  const now = new Date();
  const [topic, setTopic] = useState("");
  const [start, setStart] = useState(toLocalInput(now));
  const [end, setEnd] = useState(toLocalInput(new Date(now.getTime() + 60 * 60 * 1000)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = topic.trim() && start && end && new Date(end) > new Date(start);

  return (
    <div className="mt-2 w-full max-w-xs space-y-2 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3 text-left">
      <p className="text-xs font-medium text-brand-700">Admin · start a session</p>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Session topic…"
        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
      />
      <label className="block text-[11px] text-muted-foreground">Start
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}
          className="mt-0.5 h-9 w-full rounded-lg border border-border bg-card px-2 text-sm outline-none focus:border-brand-400" />
      </label>
      <label className="block text-[11px] text-muted-foreground">End
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)}
          className="mt-0.5 h-9 w-full rounded-lg border border-border bg-card px-2 text-sm outline-none focus:border-brand-400" />
      </label>
      {err && <p className="text-[11px] text-destructive">{err}</p>}
      <Button
        size="sm"
        className="w-full"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true); setErr(null);
          try {
            await onCreate(topic.trim(), new Date(start).toISOString(), new Date(end).toISOString());
          } catch (e: unknown) {
            setErr(errMessage(e, "Could not create session."));
          } finally { setBusy(false); }
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Start session
      </Button>
    </div>
  );
}
