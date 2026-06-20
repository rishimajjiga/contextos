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
            f