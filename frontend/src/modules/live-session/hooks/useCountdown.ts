// ── Live Session module · countdown hook ─────────────────────────────────────
import { useEffect, useState } from "react";

export interface Countdown {
  msLeft: number;
  ended: boolean;
  /** "HH:MM:SS" (or "MM:SS" when under an hour). */
  label: string;
}

function format(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Ticks every second toward `target` (ISO string). Inert when target is null. */
export function useCountdown(target?: string | null): Countdown {
  const compute = (): Countdown => {
    if (!target) return { msLeft: 0, ended: true, label: "00:00" };
    const ms = new Date(target).getTime() - Date.now();
    return { msLeft: Math.max(0, ms), ended: ms <= 0, label: format(ms) };
  };

  const [state, setState] = useState<Countdown>(compute);

  useEffect(() => {
    setState(compute());
    if (!target) return;
    const t = setInterval(() => setState(compute()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return state;
}
