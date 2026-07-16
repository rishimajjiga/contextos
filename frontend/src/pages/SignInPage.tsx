import { SignIn } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

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
            colorPrimary: "#4f9437",
            colorBackground: "hsl(96 50% 99%)",
            colorInputBackground: "hsl(100 33% 97%)",
            colorText: "hsl(130 28% 13%)",
            colorTextSecondary: "hsl(125 14% 38%)",
            // colorNeutral drives the social-button background — light sage value
            // keeps the Google button on-theme with the rest of the page.
            colorNeutral: "hsl(102 20% 90%)",
            colorInputText: "hsl(130 28% 13%)",
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
