import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiClient } from "@/services/api";

const FLAG_KEY = "ctxos_native_handoff";
const STATUS_KEY = "ctxos_native_handoff_status";

/**
 * There's no way to see this Custom Tab's console output from outside it — no
 * USB debugging, no remote inspect, nothing. Writing status here (readable by
 * NativeCallbackPage's stuck-fallback UI) is the only way to get any
 * visibility into what actually happened.
 */
function setStatus(status: string) {
  try {
    sessionStorage.setItem(STATUS_KEY, status);
  } catch {
    // Nothing more to do if storage itself is unavailable.
  }
}

export function readNativeHandoffStatus(): string | null {
  try {
    return sessionStorage.getItem(STATUS_KEY);
  } catch {
    return null;
  }
}

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
  setStatus("pending:marked before leaving for Google");
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
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const firing = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setStatus(`not-signed-in:isLoaded=${isLoaded} isSignedIn=${isSignedIn}`);
      return;
    }
    if (firing.current) return;

    let pending = false;
    try {
      pending = sessionStorage.getItem(FLAG_KEY) === "1";
    } catch {
      pending = false;
    }
    if (!pending) {
      setStatus("skipped:no pending flag found (markNativeHandoffPending never ran, or storage lost it)");
      return;
    }

    firing.current = true;
    try {
      sessionStorage.removeItem(FLAG_KEY);
    } catch {
      // Non-fatal — firing.current already guards against a repeat this session.
    }
    setStatus("started:isSignedIn is true, flag found, requesting token");

    (async () => {
      try {
        // apiClient's own interceptor only attaches a token once AuthProvider (see
        // AppLayout.tsx) has mounted and called setTokenGetter — which never happens
        // on a bare public route like /native-callback. This hook has to run on ANY
        // route by design (see markNativeHandoffPending's doc comment), so it can't
        // depend on that wiring: get the token straight from Clerk and attach it
        // explicitly instead.
        const token = await getToken();
        if (!token) throw new Error("getToken() returned no token (Clerk returned null/empty)");
        setStatus("got-token:calling /auth/native-ticket");
        const { data } = await apiClient.post<{ ticket: string }>(
          "/auth/native-ticket",
          undefined,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setStatus("got-ticket:redirecting to contextos://");
        window.location.href = `contextos://native-sign-in?ticket=${encodeURIComponent(data.ticket)}`;
        setStatus("redirected:contextos:// navigation issued");
      } catch (err: any) {
        // The user is still successfully signed in on the website regardless —
        // worst case they don't get auto-returned and have to switch back manually.
        const detail = err?.response
          ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
          : err?.message || String(err);
        setStatus(`error:${detail}`);
        console.error("[native-handoff] failed to hand session back to the app", err);
      }
    })();
  }, [isLoaded, isSignedIn, getToken]);
}
