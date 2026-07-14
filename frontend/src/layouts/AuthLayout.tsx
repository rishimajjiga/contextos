import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-0">
      {/* Header */}
      {/* pt-safe: logo header sits below the status bar / notch */}
      <header className="border-b border-border px-6 py-4 pt-[max(1rem,var(--safe-top))]">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo_mark.png" alt="ContextOS" className="h-7 w-7 rounded-md" />
          <span className="text-sm font-semibold text-foreground">ContextOS</span>
        </Link>
      </header>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
