import { SignUp } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

export function SignUpPage() {
  // Honour ?redirect_url= so invite links (/join/:token) resume after sign-up.
  const [params] = useSearchParams();
  const raw = params.get("redirect_url") || "";
  const redirect = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
  const signInUrl = redirect !== "/dashboard"
    ? `/sign-in?redirect_url=${encodeURIComponent(redirect)}`
    : "/sign-in";

  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-8 text-sm text-muted-foreground">Give your AI tools a shared memory</p>
      <SignUp
        routing="hash"
        afterSignUpUrl={redirect}
        forceRedirectUrl={redirect}
        signInUrl={signInUrl}
        appearance={{
          variables: {
            colorPrimary: "#2F9E44",
            colorBackground: "#FFFFFF",
            colorInputBackground: "#FAFCFB",
            colorText: "#1E293B",
            colorTextSecondary: "#64748B",
            colorInputText: "#1E293B",
            colorNeutral: "#E5E7EB",
            borderRadius: "0.75rem",
            fontFamily: "inherit",
          },
          elements: {
            card: "!shadow-card !border !border-border !bg-card !rounded-2xl !overflow-hidden",
            headerTitle: "hidden",
            headerSubtitle: "hidden",
            socialButtonsBlockButton:
              "!bg-card !border !border-border !text-foreground hover:!bg-accent !transition-all !duration-200 !shadow-soft !rounded-lg",
            socialButtonsBlockButtonText: "!text-sm !font-medium !text-foreground",
            socialButtonsBlockButtonArrow: "!text-foreground/40",
            dividerLine: "!bg-border",
            dividerText: "!text-foreground/40 !text-xs",
            formFieldInput:
              "!bg-card !border-border !text-foreground focus:!border-brand-400 !transition-colors",
            formFieldLabel: "!text-foreground/70 !text-sm",
            formButtonPrimary:
              "!bg-brand-500 hover:!bg-brand-600 !shadow-soft !transition-colors",
            footerActionLink: "!text-brand-600 hover:!text-brand-700 !transition-colors",
            cardBox: "!shadow-none",
          },
        }}
      />
    </div>
  );
}
