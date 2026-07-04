import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-0 text-center px-6">
      <p className="text-7xl font-bold text-brand-500 mb-4">404</p>
      <h1 className="text-2xl font-semibold text-foreground mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-8 max-w-xs">
        This page doesn't exist or was moved.
      </p>
      <Link to="/dashboard">
        <Button variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Button>
      </Link>
    </div>
  );
}
