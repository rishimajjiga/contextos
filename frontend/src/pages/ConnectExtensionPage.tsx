/**
 * /connect-extension
 *
 * Opened by the Chrome extension popup when the user has no API key.
 * Shows a Clerk sign-in form if the user is not authenticated.
 * After sign-in, auto-creates an API key and passes it back to the
 * extension via the URL hash, which background.js reads automatically.
 */

import { useEffect, useRef, useState } from "react";
import { useAuth, SignIn } from "@clerk/clerk-react";

type Stage = "loading" | "signing-in" | "connecting" | "success" | "error";

const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#6366f1",
    colorBackground: "hsl(240 5% 7%)",
    colorInputBackground: "hsl(240 4% 14%)",
    colorText: "hsl(0 0% 95%)",
    colorTextSecondary: "hsl(240 5% 55%)",
    colorInputText: "hsl(0 0% 95%)",
    borderRadius: "0.5rem",
  },
  elements: {
    card: "shadow-none border border-border bg-card",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
  },
};

export function ConnectExtensionPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const didConnect = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setStage("signing-in");
      return;
    }
    // Already signed in — proceed to create API key
    if (didConnect.current) return;
    didConnect.current = true;
    setStage("connecting");
    connectExtension();
  }, [isLoaded, isSignedIn]);

  async function connectExtension() {
    try {
      const token = await getToken();
      if (!token) throw new Error("Could not get auth token. Please sign in again.");

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

      // Pass key + URLs to the extension via URL hash.
      // background.js watches hash changes on /connect-extension pages.
      const backendUrl = base;
      const frontendUrl = window.location.origin;
      window.location.hash =
        "key=" + encodeURIComponent(created.key) +
        "&apiUrl=" + encodeURIComponent(backendUrl) +
        "&frontendUrl=" + encodeURIComponent(frontendUrl);

      setStage("success");

      // Auto-close the popup window after 2s
      setTimeout(() => {
        try { window.close(); } catch (_) {}
      }, 2000);
    } catch (err: any) {
      setStage("error");
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "hsl(240 5% 4%)" }}
    >
      <div
        style={{
          background: "hsl(240 5% 7%)",
          border: "1px solid hsl(240 5% 16%)",
          borderRadius: "1rem",
          padding: "2.5rem 2rem",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🧠</div>
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            color: "hsl(0 0% 95%)",
            marginBottom: "0.25rem",
          }}
        >
          ContextOS
        </h1>
        <p
          style={{
            fontSize: "0.8rem",
            color: "hsl(240 5% 55%)",
            marginBottom: stage === "signing-in" ? "1.5rem" : "2rem",
          }}
        >
          Chrome Extension Setup
        </p>

        {stage === "signing-in" && (
          <SignIn
            routing="hash"
            afterSignInUrl="/connect-extension"
            appearance={CLERK_APPEARANCE}
          />
        )}

        {stage === "loading" && (
          <p style={{ color: "hsl(240 5% 55%)", fontSize: "0.875rem" }}>
            Checking your account...
          </p>
        )}

        {stage === "connecting" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                width: "2rem",
                height: "2rem",
                border: "2px solid hsl(240 5% 20%)",
                borderTop: "2px solid #6366f1",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
            <p style={{ color: "hsl(240 5% 55%)", fontSize: "0.875rem" }}>
              Connecting your extension...
            </p>
          </div>
        )}

        {stage === "success" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "3.5rem",
                height: "3.5rem",
                background: "rgba(16,185,129,0.12)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.75rem",
              }}
            >
              ✓
            </div>
            <p style={{ color: "#34d399", fontWeight: 700, fontSize: "1.1rem" }}>
              Connected!
            </p>
            <p
              style={{
                color: "hsl(240 5% 55%)",
                fontSize: "0.8rem",
                lineHeight: 1.6,
                maxWidth: "280px",
              }}
            >
              Your ContextOS memory is now available in ChatGPT, Claude, Gemini,
              and all supported AI tools. This window will close automatically.
            </p>
          </div>
        )}

        {stage === "error" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div style={{ fontSize: "2rem" }}>⚠️</div>
            <p style={{ color: "#f87171", fontWeight: 700 }}>Connection failed</p>
            <p style={{ color: "hsl(240 5% 55%)", fontSize: "0.8rem" }}>{errorMsg}</p>
            <button
              onClick={() => {
                didConnect.current = false;
                setStage("connecting");
                connectExtension();
              }}
              style={{
                padding: "0.6rem 1.25rem",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.875rem",
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
