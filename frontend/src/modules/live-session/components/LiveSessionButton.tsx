// ── Live Session module · header trigger button + panel host ─────────────────
// Drop-in: `import { LiveSessionButton } from "@/modules/live-session"` and
// render <LiveSessionButton /> inside the existing nav. It renders ONLY a button
// (matching the design-system) plus a portal-mounted panel — no floating UI.

import { useState } from "react";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LivePanel } from "./LivePanel";

interface Props {
  /** Optional className passthrough to fine-tune placement in a nav. */
  className?: string;
  /** Button size — defaults to "sm" to match landing-nav buttons. */
  size?: "sm" | "default" | "lg";
}

export function LiveSessionButton({ className, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size={size}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
      >
        {/* Subtle live pulse dot */}
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Live Session
        <Radio className="hidden sm:block" />
      </Button>

      <LivePanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
