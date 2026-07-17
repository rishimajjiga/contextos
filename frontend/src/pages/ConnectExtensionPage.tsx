import { useEffect, useRef, useState } from "react";
import { useAuth, SignIn } from "@clerk/clerk-react";

type Stage = "loading" | "signing-in" | "connecting" | "limit" | "success" | "error";

export function ConnectExtensionPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [removing, setRemoving] = useState(false);
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
        const body: any = await res.json().catch(() => ({}));
        const detail: any = body?.detail;
        // API-key limit reached -> dedicated recovery screen
        if (res.status === 402 && detail && typeof detail === "object" && detail.code === "LIMIT_REACHED") {
          setStage("limit");
          return;
        }
        // detail may be a string or a structured object ({code, message, ...})
        const msg =
          typeof detail === "string" ? detail :
          detail && typeof detail === "object" && typeof detail.message === "string" ? detail.message :
          `Server error ${res.status}`;
        throw new Error(msg);
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
      setErrorMsg(typeof err?.message === "string" ? err.message : "Failed to connect extension. Please try again.");
    }
  }

  // Delete the oldest extension API key to free a slot, then retry connecting.
  async function deleteOldKeyAndRetry() {
    if (removing) return;
    setRemoving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Could not get auth token. Please sign in again.");
      const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const auth = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${base}/api/v1/api-keys`, { headers: auth });
      if (!res.ok) throw new Error(`Could not load your API keys (${res.status}).`);
      const keys: Array<{ id: string; name: string }> = await res.json();
      if (!keys.length) throw new Error("No API keys found on your account.");
      // Prefer an old extension key; the list is newest-first, so take the last.
      const pool = keys.filter((k) => k.name === "Chrome Extension");
      const target = (pool.length ? pool : keys).slice(-1)[0];
      const del = await fetch(`${base}/api/v1/api-keys/${target.id}`, { method: "DELETE", headers: auth });
      if (!del.ok && del.status !== 204) throw new Error(`Could not delete the API key (${del.status}).`);
      setRemoving(false);
      didConnect.current = true;
      setStage("connecting");
      connectExtension();
    } catch (err: any) {
      setRemoving(false);
      setStage("error");
      setErrorMsg(typeof err?.message === "string" ? err.message : "Failed to remove the API key.");
    }
  }

  const wrap: React.CSSProperties = {
    minHeight: "100dvh", display: "flex", alignItems: "center",
    justifyContent: "center", padding: "1.5rem",
    background: "#FAFCFB",
  };
  const card: React.CSSProperties = {
    background: "#FFFFFF", border: "1px solid #E5E7EB",
    borderRadius: "1.25rem", padding: "2.5rem 2rem",
    maxWidth: "420px", width: "100%", textAlign: "center",
    boxShadow: "0 2px 10px -3px rgba(30,41,59,0.08), 0 16px 40px -18px rgba(30,41,59,0.16)",
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
                colorPrimary: "#2F9E44",
                colorBackground: "#FFFFFF",
                colorInputBackground: "#FAFCFB",
                colorText: "#1E293B",
                colorTextSecondary: "#64748B",
                colorInputText: "#1E293B",
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

        {stage === "limit" && (
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: "0.72rem", fontWeight: 800, color: "#8a5a00",
              background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.30)",
              borderRadius: 999, padding: "3px 12px", marginBottom: "0.9rem",
            }}>
              ⚠️ API Key Limit Reached
            </div>
            <p style={{ color: "#1c2e1d", fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
              Your current API key has reached its usage limit.
            </p>
            <p style={{ color: "#5a6b58", fontSize: "0.8rem", lineHeight: 1.55, marginBottom: "1.25rem" }}>
              To reconnect ContextOS, delete your existing API key and add a new one,
              or upgrade your plan for uninterrupted access.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <button
                onClick={deleteOldKeyAndRetry}
                disabled={removing}
                style={{
                  flex: 1.2, padding: "0.65rem 0.5rem",
                  background: "linear-gradient(135deg,#2F9E44,#37B24D)", color: "#fff",
                  border: "none", borderRadius: "0.75rem",
                  cursor: removing ? "default" : "pointer",
                  fontWeight: 700, fontSize: "0.8rem", opacity: removing ? 0.75 : 1,
                }}
              >
                {removing ? "Removing API Key…" : "Delete API Key"}
              </button>
              <button
                onClick={() => window.open("/pricing", "_blank")}
                style={{
                  flex: 1, padding: "0.65rem 0.5rem", background: "#fff", color: "#1E7A34",
                  border: "1.5px solid rgba(47,158,68,0.4)", borderRadius: "0.75rem",
                  cursor: "pointer", fontWeight: 700, fontSize: "0.8rem",
                }}
              >
                Upgrade Plan
              </button>
            </div>
            <a href="/api-keys" target="_blank" rel="noreferrer" style={{ fontSize: "0.72rem", color: "#5a6b58" }}>
              Manage API Keys →
            </a>
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
                padding: "0.6rem 1.25rem", background: "#2F9E44", color: "#fff",
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
