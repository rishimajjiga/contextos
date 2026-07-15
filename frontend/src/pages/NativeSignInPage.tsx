import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSignIn } from "@clerk/clerk-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorAlert } from "@/components/common/ErrorAlert";

/**
 * Landing point for the Android app's native Google sign-in bridge.
 *
 * Google blocks its OAuth screen from rendering in any embedded WebView, so
 * the Android app signs the user in with Clerk's native Android SDK instead
 * (outside the WebView entirely) and asks the backend to mint a one-time
 * Clerk sign-in token (see backend app/api/v1/endpoints/native_session.py).
 * The app then loads this page with that token as `?ticket=`, and this page
 * exchanges it for a real web session — the same mechanism Clerk uses for
 * emailed magic sign-in links.
 */
export function NativeSignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!isLoaded || attempted.current) return;

    const ticket = params.get("ticket");
    if (!ticket) {
      setError("Missing sign-in ticket.");
      return;
    }

    attempted.current = true;

    (async () => {
      try {
        const attempt = await signIn!.create({ strategy: "ticket", ticket });
        if (attempt.status === "complete") {
          await setActive!({ session: attempt.createdSessionId });
          navigate("/dashboard", { replace: true });
        } else {
          setError("Sign-in could not be completed.");
        }
      } catch {
        setError("This sign-in link is invalid or has expired.");
      }
    })();
  }, [isLoaded, params, signIn, setActive, navigate]);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface-0 px-6">
      {error ? (
        <div className="w-full max-w-sm">
          <ErrorAlert message={error} onRetry={() => navigate("/sign-in", { replace: true })} />
        </div>
      ) : (
        <LoadingSpinner size="lg" />
      )}
    </div>
  );
}
