// ── Live Session module · isolated ticking countdown ─────────────────────────
// Renders ONLY the time-left text and ticks every second on its own, so the
// surrounding card / chat list doesn't re-render each second.

import { useCountdown } from "../hooks/useCountdown";

export function Countdown({ target }: { target?: string | null }) {
  const { label, ended } = useCountdown(target);
  return <>{ended ? "00:00" : label}</>;
}
