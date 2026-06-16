import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/common/CommandPalette";
import { AuthProvider } from "@/contexts/AuthContext";

export function AppLayout() {
  const [cmdOpen, setCmdOpen] = useState(false);

  // ⌘K / Ctrl+K to open, Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden bg-surface-0">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar onOpenCommandPalette={() => setCmdOpen(true)} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-6xl animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </AuthProvider>
  );
}
