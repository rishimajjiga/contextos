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
    background: "hsl(96 33% 95%)",
  };
  const card: React.CSSProperties = {
    background: "hsl(96 50% 99%)", border: "1px solid hsl(102 24% 83%)",
    borderRadius: "1.25rem", padding: "2.5rem 2rem",
    maxWidth: "420px", width: "100%", textAlign: "center",
    boxShadow: "0 2px 10px -3px rgba(45,80,35,0.08), 0 16px 40px -18px rgba(45,80,35,0.16)",
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🧠</div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1c2e1d", marginBottom: "0.25rem" }}>
          ContextOS
        </h1>
        <p style={{ fontSize: "0.8rem", color: "#5a6b58", marginBottom: "1.5rem" }}>
          Chrome Extension Setup
        </p>

        {stage === "signing-in" && (
          <SignIn
            routing="hash"
            afterSignInUrl="/connect-extension"
            appearance={{
              variables: {
                colorPrimary: "#4f9437",
                colorBackground: "hsl(96 50% 99%)",
                colorInputBackground: "hsl(100 33% 97%)",
                colorText: "hsl(130 28% 13%)",
                colorTextSecondary: "hsl(125 14% 38%)",
                colorInputText: "hsl(130 28% 13%)",
                borderRadius: "0.75rem",
              },
            }}
          />
        )}

        {stage === "loading" && (
          <p style={{ color: "#5a6b58" }}>Checking your account...</p>
        )}

        {stage === "connecting" && (
          <p style={{ color: "#5a6b58" }}>Connecting your extension...</p>
        )}

        {stage === "success" && (
          <div>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</div>
            <p style={{ color: "#2e7d32", fontWeight: 700 }}>Connected!</p>
            <p style={{ color: "#5a6b58", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              This window will close automatically.
            </p>
          </div>
        )}

        {stage === "error" && (
          <div>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
            <p style={{ color: "#dc2626", fontWeight: 700 }}>Connection failed</p>
            <p style={{ color: "#5a6b58", fontSize: "0.8rem", margin: "0.5rem 0 1rem" }}>{errorMsg}</p>
            <button
              onClick={() => { didConnect.current = false; setStage("connecting"); connectExtension(); }}
              style={{
                padding: "0.6rem 1.25rem", background: "#4f9437", color: "#fff",
                border: "none", borderRadius: "999px", cursor: "pointer", fontWeight: 700,
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
