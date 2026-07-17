import { useState } from "react";
import { SignIn, useSignIn } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

// The prebuilt <SignIn/> component's social buttons don't expose Google's
// "prompt" parameter, so they can't force the account chooser to appear —
// Google silently auto-selects the device's existing signed-in account
// instead. That's invisible on a normal browser tab most of the time (one
// account, one click), but the app restarts the *entire* sign-in flow inside
// a Custom Tab specifically to keep it cookie-consistent (see
// AppWebViewClient.kt / PublicRoute in App.tsx) — and by then Chrome usually
// already has a session from earlier browsing, so auto-select reliably
// picks the wrong account on a device with several. This bypasses the
// prebuilt component for that one flow via Clerk's lower-level API, which
// does support oidcPrompt.
function NativeGoogleSignInButton({ redirectUrlComplete }: { redirectUrlComplete: string }) {
  const { isLoaded, signIn } = useSignIn();
  const [starting, setStarting] = useState(false);

  async function start() {
    if (!isLoaded || starting) return;
    setStarting(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/native-oauth-callback",
        redirectUrlComplete,
        oidcPrompt: "select_account",
      });
    } catch {
      setStarting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={!isLoaded || starting}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-soft transition-all duration-200 hover:bg-accent disabled:opacity-60"
    >
      {starting ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}

export function SignInPage() {
  // Honour ?redirect_url= so invite links (/join/:token) resume after sign-in.
  const [params] = useSearchParams();
  const raw = params.get("redirect_url") || "";
  const redirect = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
  const signUpUrl = redirect !== "/dashboard"
    ? `/sign-up?redirect_url=${encodeURIComponent(redirect)}`
    : "/sign-up";
  // Native app handoff (redirect_url=/native-callback, from AppWebViewClient.kt) is
  // marked in PublicRoute, not here — this component's body never renders at all
  // when the browser already has a valid Clerk session, which the marking has to
  // survive. See PublicRoute in App.tsx.
  const isNativeFlow = redirect === "/native-callback";

  if (isNativeFlow) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mb-8 text-sm text-muted-foreground">Sign in to your ContextOS account</p>
        <NativeGoogleSignInButton redirectUrlComplete={redirect} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 text-sm text-muted-foreground">Sign in to your ContextOS account</p>
      <SignIn
        routing="hash"
        afterSignInUrl={redirect}
        forceRedirectUrl={redirect}
        signUpUrl={signUpUrl}
        appearance={{
          variables: {
            colorPrimary: "#2F9E44",
            colorBackground: "#FFFFFF",
            colorInputBackground: "#FAFCFB",
            colorText: "#1E293B",
            colorTextSecondary: "#64748B",
            // colorNeutral drives the social-button background — light sage value
            // keeps the Google button on-theme with the rest of the page.
            colorNeutral: "#E5E7EB",
            colorInputText: "#1E293B",
            borderRadius: "0.75rem",
            fontFamily: "inherit",
          },
          elements: {
            card: "!shadow-card !border !border-border !bg-card !rounded-2xl !overflow-hidden",
            headerTitle: "hidden",
            headerSubtitle: "hidden",
            // Social OAuth buttons (Google, GitHub, etc.)
            socialButtonsBlockButton:
              "!bg-card !border !border-border !text-foreground hover:!bg-accent !transition-all !duration-200 !shadow-soft !rounded-lg",
            socialButtonsBlockButtonText: "!text-sm !font-medium !text-foreground",
            socialButtonsBlockButtonArrow: "!text-foreground/40",
            // Divider
            dividerLine: "!bg-border",
            dividerText: "!text-foreground/40 !text-xs",
            // Inputs
            formFieldInput:
              "!bg-card !border-border !text-foreground focus:!border-brand-400 !transition-colors",
            formFieldLabel: "!text-foreground/70 !text-sm",
            // Primary action button
            formButtonPrimary:
              "!bg-brand-500 hover:!bg-brand-600 !shadow-soft !transition-colors",
            // Footer link
            footerActionLink: "!text-brand-600 hover:!text-brand-700 !transition-colors",
            // Internal card padding
            cardBox: "!shadow-none",
          },
        }}
      />
    </div>
  );
}
