import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Users } from "lucide-react";
import { teamService } from "@/services/team.service";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";

type Status = "loading" | "joining" | "success" | "error" | "unauthenticated";

export function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      // Redirect to sign-in with a return URL so we come back here after sign-in
      navigate(`/sign-in?redirect_url=/join/${token}`, { replace: true });
      return;
    }

    if (!token) {
      setStatus("error");
      setErrorMsg("Invalid invite link.");
      return;
    }

    setStatus("joining");
    teamService
      .joinOrg(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setErrorMsg(err?.message || "Failed to join team.");
        setStatus("error");
      });
  }, [isLoaded, isSignedIn, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-1 p-8 text-center shadow-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15">
          <Users className="h-7 w-7 text-brand-400" />
        </div>

        {(status === "loading" || status === "joining") && (
          <>
            <h1 className="mb-2 text-lg font-semibold text-text-primary">Joining team…</h1>
            <p className="mb-6 text-sm text-text-secondary">Just a moment.</p>
            <LoadingSpinner size="lg" />
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="mb-2 text-lg font-semibold text-text-primary">You're in! 🎉</h1>
            <p className="mb-6 text-sm text-text-secondary">
              You've joined the team. Shared project context will now appear in your AI tools.
            </p>
            <Button onClick={() => navigate("/team")} className="w-full">
              Go to Team page
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="mb-2 text-lg font-semibold text-red-400">Invite error</h1>
            <p className="mb-6 text-sm text-text-secondary">{errorMsg}</p>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
