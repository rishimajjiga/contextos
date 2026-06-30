// ── Live Session module · AdSense loader ──────────────────────────────────────
// Injects the AdSense script once (only when configured). No CSP issues: the
// app has no restrictive CSP meta. For EU traffic you must also run a CMP /
// Google Consent Mode v2 (not included here).

import { ADSENSE_CLIENT, isAdsenseConfigured } from "../config";

let injected = false;

export function ensureAdsenseScript(): void {
  if (injected || !isAdsenseConfigured()) return;
  if (typeof document === "undefined") return;
  injected = true;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
}

export function pushAd(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
  } catch { /* ad already filled / blocked */ }
}
