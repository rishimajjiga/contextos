// ── Live Session module · header trigger button + panel host ─────────────────
// Drop-in: `import { LiveSessionButton } from "@/modules/live-session"`.
// Shared links auto-open the panel: ?live=1 (chat) and ?poll=<id> (Polls tab).

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LivePanel } from "./LivePanel";
import { LIVE_SHARE_PARAM, POLL_SHARE_PARAM } from "../config";

interface Props {
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function LiveSessionButton({ className, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"live" | "polls">("live");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const hasPoll = params.has(POLL_SHARE_PARAM);
      if (hasPoll) { setInitialTab("polls"); setOpen(true); }
      else if (params.get(LIVE_SHARE_PARAM) === "1") setOpen(true);
    } catch { /* ignore */ }
  }, []);

  return (
    <>
      <Button
        type="button"
        size={size}
        onClick={() => { setInitialTab("live"); setOpen(true); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="sm:hidden">Live</span>
        <span className="hidden sm:inline">Live Session</span>
        <Radio className="hidden sm:block" />
      </Button>

      <LivePanel open={open} onClose={() => setOpen(false)} initialTab={initialTab} />
    </>
  );
}
