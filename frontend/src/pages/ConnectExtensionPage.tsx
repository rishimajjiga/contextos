import { useEffect, useRef, useState } from "react";
import { useAuth, SignIn } from "@clerk/clerk-react";

type Stage = "loading" | "signing-in" | "connecting" | "success" | "error";

export function ConnectExtensionPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const didConnect = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setStage("signing-in"); return; }
    if (didConnect.current) return;
    didConnect.current = true;
    setStage("connecting");
    connectExtension();
  }, [isLoaded, isSignedIn]);

  async function connectExtension() {
    try {
      const token = await getToken();
      if (!token) throw new Error("Could not get auth token. Please sign in again.");
      const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");  // empty = proxied via Vercel
      const res = await fetch(`${base}/api/v1/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: "Chrome Extension" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const created = await res.json();
      window.location.hash =
        "key=" + encodeURIComponent(created.key) +
        "&apiUrl=" + encodeURIComponent(base) +
        "&frontendUrl=" + encodeURIComponent(window.location.origin);
      setStage("success");
      setTimeout(() => { try { window.close(); } catch (_) {} }, 2000);
    } catch (err: any) {
      setStage("error");
      setErrorMsg(err?.message ?? "Failed to connect extension. Please try again.");
    }
  }

  const wrap: React.CSSProperties = {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", padding: "1.5rem",
    background: "hsl(240 5% 4%)",
  };
  const card: React.CSSProperties = {
    background: "hsl(240 5% 7%)", border: "1px solid hsl(240 5% 16%)",
    borderRadius: "1rem", padding: "2.5rem 2rem",
    maxWidth: "420px", width: "100%", textAlign: "center",
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🧠</div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f2f2f2", marginBottom: "0.25rem" }}>
          ContextOS
        </h1>
        <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "1.5rem" }}>
          Chrome Extension Setup
        </p>

        {stage === "signing-in" && (
          <SignIn
            routing="hash"
            afterSignInUrl="/connect-extension"
            appearance={{
              variables: {
                colorPrimary: "#6366f1",
                colorBackground: "hsl(240 5% 7%)",
                colorInputBackground: "hsl(240 4% 14%)",
                colorText: "hsl(0 0% 95%)",
                colorTextSecondary: "hsl(240 5% 55%)",
                colorInputText: "hsl(0 0% 95%)",
                borderRadius: "0.5rem",
              },
            }}
          />
        )}

        {stage === "loading" && (
          <p style={{ color: "#888" }}>Checking your account...</p>
        )}

        {stage === "connecting" && (
          <p style={{ color: "#888" }}>Connecting your extension...</p>
        )}

        {stage === "success" && (
          <div>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</div>
            <p style={{ color: "#34d399", fontWeight: 700 }}>Connected!</p>
            <p style={{ color: "#888", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              This window will close automatically.
            </p>
          </div>
        )}

        {stage === "error" && (
          <div>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
            <p style={{ color: "#f87171", fontWeight: 700 }}>Connection failed</p>
            <p style={{ color: "#888", fontSize: "0.8rem", margin: "0.5rem 0 1rem" }}>{errorMsg}</p>
            <button
              onClick={() => { didConnect.current = false; setStage("connecting"); connectExtension(); }}
              style={{
                padding: "0.6rem 1.25rem", background: "#6366f1", color: "#fff",
                border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 700,
              }}
            >
              Try Again
            </button>
          </div>
        )}
      