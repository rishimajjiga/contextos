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
    const base = import.meta.env.VITE_API_URL || "http://localhost:8000";
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
            "Cannot reach the backend on port 8000. Start the server with: uvicorn app.main:app --reload",
        });
      });
  }, []);

  return status;
}
