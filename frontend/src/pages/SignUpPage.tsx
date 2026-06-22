import { SignUp } from "@clerk/clerk-react";

export function SignUpPage() {
  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-8 text-sm text-muted-foreground">Give your AI tools a shared memory</p>
      <SignUp
        routing="hash"
        afterSignUpUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: "#4f9437",
            colorBackground: "hsl(96 50% 99%)",
            colorInputBackground: "hsl(100 33% 97%)",
            colorText: "hsl(130 28% 13%)",
            colorTextSecondary: "hsl(125 14% 38%)",
            colorInputText: "hsl(130 28% 13%)",
            colorNeutral: "hsl(102 20% 90%)",
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
