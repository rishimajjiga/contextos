/**
 * /connect-extension
 *
 * Opened by the Chrome extension popup when the user has no API key.
 * 1. Requires Clerk login (redirects back here after sign-in).
 * 2. Auto-creates an API key named "Chrome Extension".
 * 3. Writes the key to a hidden DOM element (#ctx-api-key[data-key]).
 *    The extension's background.js polls this element every second and
 *    saves the key automatically — no manual copy-paste needed.
 * 4. Shows a success screen; the extension closes this tab after ~2 s.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

type Stage = "loading" | "connecting" | "success" | "error";

export function ConnectExtensionPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const didConnect = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      // Preserve the full path + query so Clerk brings us back here after sign-in
      const returnTo = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      navigate(`/sign-in?redirect_url=${returnTo}`);
      return;
    }

    if (didConnect.current) return;
    didConnect.current = true;
    connectExtension();
  }, [isLoaded, isSignedIn]);

  async function connectExtension() {
    setStage("connecting");
    try {
      // Get the Clerk JWT directly — this page is outside AppLayout so the
      // shared Axios interceptor has no token getter. Fetch directly instead.
      const token = await getToken();
      if (!token) throw new Error("Could not get auth token — please sign in again.");

      const base = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const res = await fetch(`${base}/api/v1/api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: "Chrome Extension" }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }

      const created = await res.json();

      // Signal the extension by putting the key in the URL hash.
      // chrome.tabs.onUpdated fires on every URL/hash change, waking the
      // service worker which reads and saves the key automatically.
      window.location.hash = "key=" + encodeURIComponent(created.key);

      setStage("success");
    } catch (err: any) {
      setStage("error");
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
      <div className="bg-surface-1 border border-border rounded-2xl p-10 max-w-md w-full text-center shadow-xl">
        <div className="text-5xl mb-5">🧠</div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">ContextOS</h1>
        <p className="text-text-secondary text-sm mb-8">Chrome Extension Setup</p>

        {stage === "loading" && (
          <p className="text-text-secondary">Checking your account…</p>
        )}

        {stage === "connecting" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-text-secondary">Creating your API key…</p>
          </div>
        )}

        {stage === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center text-3xl">
              ✓
            </div>
            <p className="text-green-400 font-semibold text-lg">Connected!</p>
            <p className="text-text-secondary text-sm">
              Your ContextOS memory is now available in ChatGPT, Claude, Gemini,
              and all supported AI tools. This tab will close automatically.
            </p>
          </div>
        )}

        {stage === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-3xl">⚠️</div>
            <p className="text-red-400 font-semibold">Connection failed</p>
            <p className="text-text-secondary text-sm">{errorMsg}</p>
            <button
              onClick={() => { didConnect.current = false; connectExtension(); }}
              className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
