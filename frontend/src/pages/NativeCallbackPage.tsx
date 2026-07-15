import { LoadingSpinner } from "@/components/common/LoadingSpinner";

/**
 * Landing point for sign-in started from the Android app — reached when Clerk
 * honors forceRedirectUrl after the full sign-in flow (Google included, see
 * AppWebViewClient.kt) completes inside the Custom Tab. The actual hand-off
 * back to the app (minting a ticket, redirecting to contextos://) is done by
 * useNativeHandoff(), mounted once at the app root — not here — because
 * Clerk doesn't reliably land the user on this exact route across the full
 * Google -> Clerk -> app redirect chain; the root-level hook fires regardless
 * of which authenticated page is actually showing. This page only exists to
 * show a calmer "returning to the app" message in the case where Clerk does
 * land here instead of on, say, /dashboard.
 */
export function NativeCallbackPage() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface-0 px-6">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-muted-foreground">Signed in — returning to the app…</p>
    </div>
  );
}
