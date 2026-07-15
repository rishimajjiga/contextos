import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { request } from "@/services/api";

const FLAG_KEY = "ctxos_native_handoff";

/**
 * Call once, as soon as a sign-in flow that was opened by the Android app
 * begins (see SignInPage.tsx) — before the user ever reaches Google. Survives
 * the entire Google -> Clerk -> app redirect chain because sessionStorage is
 * scoped to the browser tab/origin, not to any particular page: it doesn't
 * depend on Clerk reliably propagating a custom post-sign-in redirect target
 * through that multi-domain round trip, which in practice isn't reliable —
 * Clerk can land the user on /native-callback, /dashboard, or even back on
 * /sign-in depending on the exact path taken.
 */
export function markNativeHandoffPending() {
  try {
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    // Storage unavailable (private mode, etc.) — the app just won't auto-return;
    // the user is still signed in on the website either way.
  }
}

/**
 * Mounted once at the app root (see App.tsx) so it fires no matter which page
 * Clerk lands the user on after sign-in completes, rather than depending on a
 * specific route being reached — see markNativeHandoffPending() for why.
 * Mints a one-time Clerk ticket (backend: /api/v1/auth/native-ticket) and
 * hands it to the Android app via the existing contextos:// custom scheme;
 * the app's WebView redeems it at /native-sign-in to get its own web session
 * (WebView and the Custom Tab this ran in never share cookies).
 */
export function useNativeHandoff() {
  const { isLoaded, isSignedIn } = useAuth();
  const firing = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || firing.current) return;

    let pending = false;
    try {
      pending = sessionStorage.getItem(FLAG_KEY) === "1";
    } catch {
      pending = false;
    }
    if (!pending) return;

    firing.current = true;
    try {
      sessionStorage.removeItem(FLAG_KEY);
    } catch {
      // Non-fatal — firing.current already guards against a repeat this session.
    }

    (async () => {
      try {
        const { ticket } = await request<{ ticket: string }>({ method: "POST", url: "/auth/native-ticket" });
        window.location.href = `contextos://native-sign-in?ticket=${encodeURIComponent(ticket)}`;
      } catch {
        // Swallow — the user is still successfully signed in on the website;
        // worst case they just don't get auto-returned to the app.
      }
    })();
  }, [isLoaded, isSignedIn]);
}
