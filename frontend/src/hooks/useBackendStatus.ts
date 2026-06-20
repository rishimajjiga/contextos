import { useState, useEffect } from "react";

interface BackendStatus {
  checking: boolean;
  ok: boolean;
  message: string | null;
}

export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>({
    checking: true,
    ok: false,
    message: null,
  });

  useEffect(() => {
    // Empty base = relative URL, proxied via Vercel to the Railway backend
    // (same convention as api.ts). Falling back to localhost:8000 made the
    // deployed site health-check the user's own machine and wrongly report
    // "Backend not running".
    const base = import.meta.env.VITE_API_URL || "";
    fetch(`${base}/health`, { method: "GET" })
      .then((res) => {
        if (res.ok) {
          setStatus({ checking: false, ok: true, message: null });
        } else {
          setStatus({
            checking: false,
            ok: false,
            message: `Backend returned ${res.status}. Restart the server and try again.`,
          });
        }
      })
      .catch(() => {
        setStatus({
          checking: false,
          ok: false,
          message:
            "Cannot reach the backend. Please try again in a moment.",
        });
      });
  }, []);

  return status;
}
