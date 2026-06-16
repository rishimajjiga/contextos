import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";

import { DashboardPage } from "@/pages/DashboardPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { KnowledgePage } from "@/pages/KnowledgePage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { DocumentDetailPage } from "@/pages/DocumentDetailPage";
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

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/sign-in"
        element={
          <PublicRoute>
            <AuthLayout>
              <SignInPage />
            </AuthLayout>
          </PublicRoute>
        }
      />
      <Route
        path="/sign-up"
        element={
          <PublicRoute>
            <AuthLayout>
              <SignUpPage />
            </AuthLayout>
          </PublicRoute>
        }
      />

      {/* Protected — wrapped in AppLayout (sidebar + topbar) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/api-keys" element={<ApiKeysPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/team" element={<TeamPage />} />
      </Route>

      {/* Extension connect — handles its own auth so ext_id is preserved through sign-in */}
      <Route path="/connect-extension" element={<ConnectExtensionPage />} />

      {/* Pricing — public */}
      <Route path="/pricing" element={<PricingPage />} />

      {/* Join team via invite link — handles its own auth redirect */}
      <Route path="/join/:token" element={<JoinPage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
