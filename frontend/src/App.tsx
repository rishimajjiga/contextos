import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";

import { DashboardPage } from "@/pages/DashboardPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { MemoriesPage } from "@/pages/MemoriesPage";
import { SaveMemoryPage } from "@/pages/SaveMemoryPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { SearchPage } from "@/pages/SearchPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ApiKeysPage } from "@/pages/ApiKeysPage";
import { SignInPage } from "@/pages/SignInPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { LandingPage } from "@/pages/LandingPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ConnectExtensionPage } from "@/pages/ConnectExtensionPage";
import { PricingPage } from "@/pages/PricingPage";
import { TeamPage } from "@/pages/TeamPage";
import { JoinPage } from "@/pages/JoinPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { PaymentHistoryPage } from "@/pages/PaymentHistoryPage";
import { PaymentSuccessPage } from "@/pages/PaymentSuccessPage";
import { PaymentFailurePage } from "@/pages/PaymentFailurePage";

import { LoadingSpinner } from "@/components/common/LoadingSpinner";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [params] = useSearchParams();
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
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
      {/* Payment result pages — public so Razorpay callback_url works without auth */}
      <Route path="/payment/success"    element={<PaymentSuccessPage />} />
      <Route path="/payment/failure"    element={<PaymentFailurePage />} />
      <Route path="/payment/cancel"     element={<PaymentFailurePage />} />
      <Route path="*"                   element={<NotFoundPage />} />
    </Routes>
  );
}
