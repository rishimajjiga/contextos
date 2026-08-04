import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { useAuth, useClerk } from "@clerk/clerk-react";

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { useNativeHandoff, markNativeHandoffPending } from "@/hooks/useNativeHandoff";

// LandingPage stays eager: it is the public entry / LCP-critical first paint,
// so we avoid an extra chunk round-trip for first-time visitors.
import { LandingPage } from "@/pages/LandingPage";

// Everything else is route-split via React.lazy so a given page's JS is only
// downloaded when that route is visited. Named exports are adapted to the
// default-export shape React.lazy expects — no changes to the page files,
// preserving 100% of existing behaviour.
const AppLayout            = lazy(() => import("@/layouts/AppLayout").then(m => ({ default: m.AppLayout })));
const AuthLayout           = lazy(() => import("@/layouts/AuthLayout").then(m => ({ default: m.AuthLayout })));
const DashboardPage        = lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const ProfilePage          = lazy(() => import("@/pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const MemoriesPage         = lazy(() => import("@/pages/MemoriesPage").then(m => ({ default: m.MemoriesPage })));
const SaveMemoryPage       = lazy(() => import("@/pages/SaveMemoryPage").then(m => ({ default: m.SaveMemoryPage })));
const ProjectsPage         = lazy(() => import("@/pages/ProjectsPage").then(m => ({ default: m.ProjectsPage })));
const ProjectDetailPage    = lazy(() => import("@/pages/ProjectDetailPage").then(m => ({ default: m.ProjectDetailPage })));
const SearchPage           = lazy(() => import("@/pages/SearchPage").then(m => ({ default: m.SearchPage })));
const SettingsPage         = lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const ApiKeysPage          = lazy(() => import("@/pages/ApiKeysPage").then(m => ({ default: m.ApiKeysPage })));
const SignInPage           = lazy(() => import("@/pages/SignInPage").then(m => ({ default: m.SignInPage })));
const NativeSignInPage     = lazy(() => import("@/pages/NativeSignInPage").then(m => ({ default: m.NativeSignInPage })));
const NativeCallbackPage   = lazy(() => import("@/pages/NativeCallbackPage").then(m => ({ default: m.NativeCallbackPage })));
const NativeOAuthCallbackPage = lazy(() => import("@/pages/NativeOAuthCallbackPage").then(m => ({ default: m.NativeOAuthCallbackPage })));
const SignUpPage           = lazy(() => import("@/pages/SignUpPage").then(m => ({ default: m.SignUpPage })));
const NotFoundPage         = lazy(() => import("@/pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));
const ConnectExtensionPage = lazy(() => import("@/pages/ConnectExtensionPage").then(m => ({ default: m.ConnectExtensionPage })));
const PricingPage          = lazy(() => import("@/pages/PricingPage").then(m => ({ default: m.PricingPage })));
const TeamPage             = lazy(() => import("@/pages/TeamPage").then(m => ({ default: m.TeamPage })));
const JoinPage             = lazy(() => import("@/pages/JoinPage").then(m => ({ default: m.JoinPage })));
const PrivacyPage          = lazy(() => import("@/pages/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const DeleteAccountPage    = lazy(() => import("@/pages/DeleteAccountPage").then(m => ({ default: m.DeleteAccountPage })));
const PaymentHistoryPage   = lazy(() => import("@/pages/PaymentHistoryPage").then(m => ({ default: m.PaymentHistoryPage })));
const FounderPanelPage     = lazy(() => import("@/pages/FounderPanelPage").then(m => ({ default: m.FounderPanelPage })));
const PaymentSuccessPage   = lazy(() => import("@/pages/PaymentSuccessPage").then(m => ({ default: m.PaymentSuccessPage })));
const PaymentFailurePage   = lazy(() => import("@/pages/PaymentFailurePage").then(m => ({ default: m.PaymentFailurePage })));
const ContextHubPage       = lazy(() => import("@/pages/ContextHubPage").then(m => ({ default: m.ContextHubPage })));

function FullScreenLoader() {
  return (
    <div className="flex h-dvh items-center justify-center bg-surface-0">
      <LoadingSpinner size="lg" />
    </div>
  );
}

// Clerk's `isLoaded` normally flips to true within a few hundred ms. It can hang
// indefinitely, though, when Clerk's cross-origin session-sync handshake (its
// dev-instance default domain, clerk.accounts.dev, talking to this app's own
// origin via a third-party-cookie-dependent iframe) never resolves — a known
// Clerk failure mode inside Android WebView, where third-party/cross-origin
// storage is more restricted than in a full desktop/mobile browser. Without this
// timeout, ProtectedRoute/PublicRoute would render <FullScreenLoader/> forever:
// exactly the "black screen after login, works fine in browser" symptom.
const AUTH_LOAD_TIMEOUT_MS = 8000;

function useAuthLoadTimedOut(isLoaded: boolean): boolean {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (isLoaded) return;
    const timer = window.setTimeout(() => {
      console.error(
        `[auth] Clerk isLoaded did not resolve within ${AUTH_LOAD_TIMEOUT_MS}ms — likely a stuck cross-origin session-sync handshake with the Clerk dev instance.`
      );
      setTimedOut(true);
    }, AUTH_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);
  return timedOut;
}

function AuthLoadTimeoutScreen() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface-0 px-6">
      <div className="w-full max-w-sm">
        <ErrorAlert
          message="Couldn't reach the sign-in server. Check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const timedOut = useAuthLoadTimedOut(isLoaded);
  if (!isLoaded) return timedOut ? <AuthLoadTimeoutScreen /> : <FullScreenLoader />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}

// Set by the Android app on the sign-in URL it opens in a Custom Tab (see
// AppWebViewClient.openInCustomTab). Means: "do not resolve this sign-in against
// whatever session this browser already has — make the user choose an account."
const FORCE_REAUTH_PARAM = "force_reauth";

// Timestamp of the last force-reauth sign-out attempt in this tab. sessionStorage,
// not a ref: signOut() navigates, so the component remounts and any in-memory guard
// is lost exactly when it is needed.
const FORCE_REAUTH_ATTEMPTED_KEY = "ctxos_force_reauth_attempted_at";

// A timestamp rather than a boolean so the guard expires on its own. The two failure
// modes it sits between are both real:
//  - Clearing the mark as soon as the session looks gone re-arms the sign-out, so a
//    Clerk session that re-hydrates (revoke request dropped, local state cleared
//    anyway) would sign out -> redirect -> re-hydrate -> sign out… forever, in a
//    Custom Tab the user can only escape by killing Chrome.
//  - Never clearing it means the SECOND sign-out/sign-in cycle in a reused Chrome tab
//    silently skips the sign-out and the stale-session bug comes back.
// A cooldown fixes both: a loop retriggers within milliseconds and is blocked, while a
// genuine new sign-in is always far later — the user has to complete Google in between.
const FORCE_REAUTH_COOLDOWN_MS = 15_000;

function forceReauthAttemptedRecently(): boolean {
  try {
    const at = Number(sessionStorage.getItem(FORCE_REAUTH_ATTEMPTED_KEY)) || 0;
    return at > 0 && Date.now() - at < FORCE_REAUTH_COOLDOWN_MS;
  } catch {
    // Storage blocked (private mode) — report "not attempted" so the sign-out still
    // runs. The render guard below is what actually prevents a loop in that case.
    return false;
  }
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const timedOut = useAuthLoadTimedOut(isLoaded);
  const [params] = useSearchParams();

  const forceReauth = params.get(FORCE_REAUTH_PARAM) === "1";
  const signingOut = useRef(false);

  // Read once at mount, BEFORE the effect below can write it, so the render pass
  // can distinguish "sign-out about to run" from "sign-out already ran and the
  // session outlived it".
  const [reauthAlreadyAttempted] = useState(forceReauthAttemptedRecently);

  // The app's WebView and the Custom Tab are separate browsers with separate cookie
  // jars, so signing out inside the app cannot clear the ContextOS session cookie
  // Chrome kept from the previous sign-in. Without this, that stale session made the
  // isSignedIn branch below fire, SignInPage never rendered, and useNativeHandoff
  // handed the OLD account back to the app without Google ever being contacted.
  //
  // signOut() ends only THIS site's session in this browser. Google's own cookies on
  // accounts.google.com are untouched — the user stays signed into Google in Chrome,
  // and the chooser appears because SignInPage passes oidcPrompt: "select_account".
  useEffect(() => {
    if (!forceReauth || !isLoaded || !isSignedIn) return;
    if (signingOut.current || reauthAlreadyAttempted) return;
    signingOut.current = true;
    try {
      sessionStorage.setItem(FORCE_REAUTH_ATTEMPTED_KEY, String(Date.now()));
    } catch {
      // Storage blocked (private mode). The render guard below still prevents a loop,
      // because a signOut that leaves the session live lands on the same URL with
      // isSignedIn true and falls through to the sign-in UI rather than redirecting.
    }
    // redirectUrl overrides <ClerkProvider afterSignOutUrl="/">, which would otherwise
    // strand the Custom Tab on the landing page and silently abandon the sign-in the
    // app asked for. Coming back to this same URL re-enters this component with no
    // session, which is the state that renders the account picker.
    void signOut({ redirectUrl: window.location.pathname + window.location.search });
  }, [forceReauth, isLoaded, isSignedIn, signOut, reauthAlreadyAttempted]);

  // Must run unconditionally, before the isSignedIn branch below can bail out
  // to <Navigate> — if the Custom Tab this loaded in already has a valid Clerk
  // session from earlier testing (Chrome persists cookies across launches,
  // unlike the app's own WebView), SignInPage's body never renders at all, so
  // marking the handoff there (its previous location) silently never ran.
  useEffect(() => {
    if (!isLoaded) return;
    // Under force_reauth, hold this back until the stale session is actually gone.
    // useNativeHandoff (mounted at the app root) fires the instant this flag is set
    // while ANY session exists — setting it early is precisely how the signed-out
    // account got minted into a ticket and handed back to the app.
    if (forceReauth && isSignedIn) return;
    const raw = params.get("redirect_url") || "";
    if (raw === "/native-callback") markNativeHandoffPending();
  }, [params, forceReauth, isLoaded, isSignedIn]);

  if (!isLoaded) return timedOut ? <AuthLoadTimeoutScreen /> : <FullScreenLoader />;
  if (isSignedIn) {
    if (forceReauth) {
      // The app explicitly asked for a fresh account choice, so never resolve this
      // against the session already in this browser.
      // - Sign-out pending/in flight: show the loader rather than flashing a sign-in
      //   form that is about to be replaced by the redirect.
      // - Sign-out already attempted and the session survived (revoke request dropped):
      //   fall through to the sign-in UI. Redirecting here instead would reload into
      //   this same branch forever — an unbreakable loop in a Custom Tab the user can
      //   only escape by killing Chrome. Letting them pick an account is both safe and
      //   correct; Clerk swaps the active session when they do.
      if (!reauthAlreadyAttempted) return <FullScreenLoader />;
    } else {
      // Honour ?redirect_url= so invite links (/join/:token) resume after auth
      // instead of always bouncing to the dashboard.
      const raw = params.get("redirect_url") || "";
      const dest = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
      return <Navigate to={dest} replace />;
    }
  }
  return <>{children}</>;
}

// Mobile browsers/WebViews aggressively bfcache SPA pages: pressing Back can restore
// a frozen snapshot of the app instead of re-running React, so a page that was
// authenticated (or not) when it was left can show stale UI on return — e.g. landing
// back on a signed-in-only screen after signing out, or vice versa. `pageshow` fires
// on every visit including bfcache restores; `event.persisted` is true only for the
// restore case, so this only forces a reload when the stale-state risk is real.
function useBfcacheGuard() {
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);
}

export default function App() {
  useBfcacheGuard();
  useNativeHandoff();
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in" element={<PublicRoute><AuthLayout><SignInPage /></AuthLayout></PublicRoute>} />
        <Route path="/sign-up" element={<PublicRoute><AuthLayout><SignUpPage /></AuthLayout></PublicRoute>} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard"    element={<DashboardPage />} />
          <Route path="/profile"      element={<ProfilePage />} />
          <Route path="/profile-memory" element={<Navigate to="/profile" replace />} />
          <Route path="/memories"     element={<MemoriesPage />} />
          <Route path="/memories/new" element={<SaveMemoryPage />} />
          <Route path="/search"       element={<SearchPage />} />
          <Route path="/projects"     element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/api-keys"         element={<ApiKeysPage />} />
          <Route path="/settings"         element={<SettingsPage />} />
          <Route path="/team"             element={<TeamPage />} />
          <Route path="/payment-history"  element={<PaymentHistoryPage />} />
          <Route path="/founder"          element={<FounderPanelPage />} />
        </Route>

        <Route path="/connect-extension"  element={<ConnectExtensionPage />} />
        <Route path="/native-sign-in"     element={<NativeSignInPage />} />
        <Route path="/native-callback"    element={<NativeCallbackPage />} />
        <Route path="/native-oauth-callback" element={<NativeOAuthCallbackPage />} />
        <Route path="/pricing"            element={<PricingPage />} />
        <Route path="/plans"              element={<PricingPage />} />
        <Route path="/join/:token"        element={<JoinPage />} />
        <Route path="/privacy"            element={<PrivacyPage />} />
        {/* Public by requirement: this URL goes in the Play Console Data Safety form */}
        <Route path="/delete-account"     element={<DeleteAccountPage />} />
        <Route path="/context-hub"        element={<ContextHubPage />} />
        {/* Payment result pages — public so Razorpay callback_url works without auth */}
        <Route path="/payment/success"    element={<PaymentSuccessPage />} />
        <Route path="/payment/failure"    element={<PaymentFailurePage />} />
        <Route path="/payment/cancel"     element={<PaymentFailurePage />} />
        <Route path="*"                   element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
