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

      // Signal the extension via URL hash.
      // background.js watches for hash changes on /connect-extension pages
      // and saves the key + URLs automatically.
      const backendUrl = base;
      const frontendUrl = window.location.origin;
      window.location.hash =
        "key=" + encodeURIComponent(created.key) +
        "&apiUrl=" + encodeURIComponent(backendUrl) +
        "&frontendUrl=" + encodeURIComponent(frontendUrl);

      setStage("success");

      // Auto-close the popup window after 2 s
      setTimeout(() => {
        try { window.close(); } catch (_) {}
      }, 2000);
    } catch (err: any) {
      setStage("error");
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "hsl(240 5% 4%)" }}>
      <div style={{
        background: "hsl(240 5% 7%)",
        border: "1px solid hsl(240 5% 16%)",
        borderRadius: "1rem",
        padding: "2.5rem 2rem",
        maxWidth: "420px",
        width: "100%",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🧠</div>
        <h1 style={{
          fontSize: "1.25rem", fontWeight: 800,
          color: "hsl(0 0% 95%)", marginBottom: "0.25rem",
        }}>ContextOS</h1>
        <p style={{
          fontSize: "0.8rem", color: "hsl(240 5% 55%)",
          marginBottom: stage === "signing-in" ? "1.5rem" : "2rem",
        }}>Chrome Extension Setup</p>

        {/* ── Not signed in: show Clerk sign-in form ── */}
        {stage === "signing-in" && (
          <SignIn
            routing="hash"
            afterSignInUrl="/connect-extension"
            appearance={CLERK_APPEARANCE}
          />
        )}

        {/* ── Loading ── */}
        {stage === "loading" && (
          <p style={{ color: "hsl(240 5% 55%)", fontSize: "0.875rem" }}>
            Checking your account…
          </p>
        )}

        {/* ── Creating API key ── */}
        {stage === "connecting" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: "2rem", height: "2rem",
              border: "2px solid hsl(240 5% 20%)",
              borderTop: "2px solid #6366f1",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }} />
            <p style={{ color: "hsl(240 5% 55%)", fontSize: "0.875rem" }}>
              Connecting your extension…
            </p>
          </div>
        )}

        {/* ── Success ──