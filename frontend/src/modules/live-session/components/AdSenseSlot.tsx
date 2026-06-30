// ── Live Session module · in-feed AdSense slot (compliant placement) ──────────
// Labelled "Advertisement", generous spacing, lazy-loaded when scrolled into
// view, max one per polls view. Renders nothing when AdSense isn't configured
// (admins see a small hint so they know where it will appear).

import { useEffect, useRef, useState } from "react";
import { ADSENSE_CLIENT, ADSENSE_SLOT, isAdsenseConfigured } from "../config";
import { ensureAdsenseScript, pushAd } from "../lib/adsense";

export function AdSenseSlot({ isAdmin }: { isAdmin: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!isAdsenseConfigured() || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setShown(true);
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (shown) { ensureAdsenseScript(); pushAd(); }
  }, [shown]);

  // Not configured: hide from users; show a hint to admins.
  if (!isAdsenseConfigured()) {
    if (!isAdmin) return null;
    return (
      <div className="my-6 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Advertisement</p>
        <p className="mt-1 text-xs text-muted-foreground">
          AdSense slot — add <code className="rounded bg-muted px-1">ADSENSE_CLIENT</code> &{" "}
          <code className="rounded bg-muted px-1">ADSENSE_SLOT</code> in config to go live.
        </p>
      </div>
    );
  }

  return (
    <div ref={ref} className="my-6">
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Advertisement
      </p>
      {shown && (
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}
