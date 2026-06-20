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
            colorPrimary: "#6366f1",
            colorBackground: "hsl(240 5% 7%)",
            colorInputBackground: "hsl(240 4% 14%)",
            colorText: "hsl(0 0% 95%)",
            colorTextSecondary: "hsl(240 5% 55%)",
            colorInputText: "hsl(0 0% 95%)",
            borderRadius: "0.5rem",
          },
          elements: {
            card: "shadow-none border border-border bg-card",
            headerTitle: "hidden",
            headerSubtitle: "hidden",
          },
        }}
      />
    </div>
  );
}
