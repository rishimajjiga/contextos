import { SignIn } from "@clerk/clerk-react";

export function SignInPage() {
  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 text-sm text-muted-foreground">Sign in to your ContextOS account</p>
      <SignIn
        routing="hash"
        afterSignInUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: "#6366f1",
            colorBackground: "hsl(240 5% 7%)",
            colorInputBackground: "hsl(240 4% 14%)",
            colorText: "hsl(0 0% 95%)",
            colorTextSecondary: "hsl(240 5% 55%)",
            colorInputText: "hsl(0 0% 95%)",
            // colorNeutral drives the social-button background — dark value keeps
            // the Google button on-theme instead of showing a light default.
            colorNeutral: "hsl(240 4% 20%)",
            borderRadius: "0.5rem",
            fontFamily: "inherit",
          },
          elements: {
            card: "!shadow-2xl !border !border-white/10 !bg-[hsl(240_5%_7%)] !rounded-xl !overflow-hidden",
            headerTitle: "hidden",
            headerSubtitle: "hidden",
            // Social OAuth buttons (Google, GitHub, etc.)
            socialButtonsBlockButton:
              "!bg-[hsl(240_4%_14%)] !border !border-white/10 !text-white hover:!bg-[hsl(240_4%_18%)] !transition-all !duration-200 !shadow-none !rounded-lg",
            socialButtonsBlockButtonText: "!text-sm !font-medium !text-white",
            socialButtonsBlockButtonArrow: "!text-white/40",
            // Divider
            dividerLine: "!bg-white/8",
            dividerText: "!text-white/30 !text-xs",
            // Inputs
            formFieldInput:
              "!bg-[hsl(240_4%_14%)] !border-white/10 !text-white focus:!border-indigo-500/60 !transition-colors",
            formFieldLabel: "!text-white/60 !text-sm",
            // Primary action button
            formButtonPrimary:
              "!bg-indigo-600 hover:!bg-indigo-500 !shadow-none !transition-colors",
            // Footer link
            footerActionLink: "!text-indigo-400 hover:!text-indigo-300 !transition-colors",
            // Internal card padding
            cardBox: "!shadow-none",
          },
        }}
      />
    </div>
  );
}
