import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { request } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorAlert } from "@/components/common/ErrorAlert";

/**
 * Landing point for sign-in started from the Android app.
 *
 * Google refuses to render its consent screen in any embedded WebView, so the
 * app opens the *entire* sign-in flow (not just the Google step) in a Chrome
 * Custom Tab — `/sign-in?redirect_url=/native-callback` — so it stays one
 * continuous, cookie-consistent browsing session the whole way through,
 * exactly like using the site in a normal browser (see AppWebViewClient.kt).
 *
 * Once Clerk completes sign-in and lands here, this page exchanges the fresh
 * session for a one-time ticket (backend: /api/v1/auth/native-ticket) and
 * hands it to the app via the existing contextos:// custom scheme. The app's
 * WebView then redeems that ticket at /native-sign-in to establish its own,
 * separate web session — WebView and Custom Tab never share cookies, so this
 * hand-off is the only way to bridge the two.
 */
export function NativeCallbackPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState<"working" | "error">("working");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const { ticket } = await request<{ ticket: string }>({ method: "POST", url: "/auth/native-ticket" });
        window.location.href = `contextos://native-sign-in?ticket=${encodeURIComponent(ticket)}`;
      } catch {
        setStatus("error");
      }
    })();
  }, [isLoaded, isSignedIn]);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface-0 px-6">
      {status === "error" ? (
        <div className="w-full max-w-sm text-center">
          <ErrorAlert message="Couldn't hand off to the app. You can close this tab and try again." />
        </div>
      ) : (
        <>
          <LoadingSpinner size="lg" />
          <p className="text-sm text-muted-foreground">Signed in — returning to the app…</p>
        </>
      )}
    </div>
  );
}
