import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

/**
 * Completes the custom OAuth redirect flow started in SignInPage's native-app
 * branch (signIn.authenticateWithRedirect({ redirectUrl: "/native-oauth-callback",
 * oidcPrompt: "select_account", ... })) — a plain <SignIn/> component doesn't
 * expose oidcPrompt, so that flow can't use the prebuilt component's own
 * "sso-callback" handling and needs this dedicated route instead. Once
 * handleRedirectCallback finishes, Clerk itself navigates to /native-callback,
 * where useNativeHandoff() (mounted at the app root) takes over.
 */
export function NativeOAuthCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl="/native-callback"
      signUpForceRedirectUrl="/native-callback"
    />
  );
}
