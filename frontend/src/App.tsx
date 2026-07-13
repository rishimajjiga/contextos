import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

import { LoadingSpinner } from "@/components/common/LoadingSpinner";

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
const SignUpPage           = lazy(() => import("@/pages/SignUpPage").then(m => ({ default: m.SignUpPage })));
const NotFoundPage         = lazy(() => import("@/pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));
const ConnectExtensionPage = lazy(() => import("@/pages/ConnectExtensionPage").then(m => ({ default: m.ConnectExtensionPage })));
const PricingPage          = lazy(() => import("@/pages/PricingPage").then(m => ({ default: m.PricingPage })));
const TeamPage             = lazy(() => import("@/pages/TeamPage").then(m => ({ default: m.TeamPage })));
const JoinPage             = lazy(() => import("@/pages/JoinPage").then(m => ({ default: m.JoinPage })));
const PrivacyPage          = lazy(() => import("@/pages/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const PaymentHistoryPage   = lazy(() => import("@/pages/PaymentHistoryPage").then(m => ({ default: m.PaymentHistoryPage })));
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <FullScreenLoader />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [params] = useSearchParams();
  if (!isLoaded) return <FullScreenLoader />;
  if (isSignedIn) {
    // Honour ?redirect_url= so invite links (/join/:token) resume after auth
    // instead of always bouncing to the dashboard.
    const raw = params.get("redirect_url") || "";
    const dest = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
    return <Navigate to={dest} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in" element={<PublicRoute><AuthLayout><SignInPage /></AuthLayout></PublicRoute>} />
        <Route path="/sign-up" element={<PublicRoute><AuthLayout><SignUpPage /></AuthLayout></PublicRoute>} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard"    element={<DashboardPage />} />
          <Route path="/profile"      element={<ProfilePage />} />
          <Route path="/memories"     element={<MemoriesPage />} />
          <Route path="/memories/new" element={<SaveMemoryPage />} />
          <Route path="/search"       element={<SearchPage />} />
          <Route path="/projects"     element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/api-keys"         element={<ApiKeysPage />} />
          <Route path="/settings"         element={<SettingsPage />} />
          <Route path="/team"             element={<TeamPage />} />
          <Route path="/payment-history"  element={<PaymentHistoryPage />} />
        </Route>

        <Route path="/connect-extension"  element={<ConnectExtensionPage />} />
        <Route path="/pricing"            element={<PricingPage />} />
        <Route path="/plans"              element={<PricingPage />} />
        <Route path="/join/:token"        element={<JoinPage />} />
        <Route path="/privacy"            element={<PrivacyPage />} />
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
