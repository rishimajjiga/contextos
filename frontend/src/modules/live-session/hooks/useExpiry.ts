// ── Live Session module · expiry flag (single timeout, no per-second renders) ─
// Returns whether `target` has passed. Unlike a ticking countdown, this only
// re-renders the consumer ONCE — when the deadline is crossed — so big lists
// (chat, polls) don't reconcile every second.

import { useEffect, useState } from "react";

export function useExpiry(target?: string | null): boolean {
  const compute = () => (!target ? true : new Date(target).getTime() <= Date.now());
  const [ended, setEnded] = useState(compute);

  useEffect(() => {
    setEnded(compute());
    if (!target) return;
    const ms = new Date(target).getTime() - Date.now();
    if (ms <= 0) { setEnded(true); return; }
    const t = setTimeout(() => setEnded(true), ms + 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return ended;
}
