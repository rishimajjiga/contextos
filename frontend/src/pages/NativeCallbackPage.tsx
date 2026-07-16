import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

// Generous — the hand-off (mint ticket, redirect to contextos://) normally
// completes in well under a second once isSignedIn flips true. This only
// exists to give the user an out if useNativeHandoff() genuinely fails (e.g.
// a network hiccup calling /auth/native-ticket) instead of leaving them
// staring at a spinner with no explanation forever.
const STUCK_TIMEOUT_MS = 6000;

/**
 * Landing point for sign-in started from the Android app — reached when Clerk
 * honors forceRedirectUrl after the full sign-in flow (Google included, see
 * AppWebViewClient.kt) completes inside the Custom Tab. The actual hand-off
 * back to the app (minting a ticket, redirecting to contextos://) is done by
 * useNativeHandoff(), mounted once at the app root — not here — because
 * Clerk doesn't reliably land the user on this exact route across the full
 * Google -> Clerk -> app redirect chain; the root-level hook fires regardless
 * of which authenticated page is actually showing.
 */
export function NativeCallbackPage() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setStuck(true), STUCK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface-0 px-6 text-center">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-muted-foreground">Signed in — returning to the app…</p>
      {stuck && (
        <p className="max-w-xs text-xs text-muted-foreground/80">
          Taking longer than expected. You can close this tab and try signing in again from the app.
        </p>
      )}
    </div>
  );
}
