import { useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useBubbleExtension } from "@/hooks/useBubbleExtension";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

// Pure in-memory, module-level — deliberately NOT persisted to localStorage/sessionStorage.
// A previous version gated the onboarding modal behind a permanent per-user localStorage
// flag; a stale flag from earlier testing could then hide the prompt forever with no way to
// recover short of clearing site data. In-memory state can only ever reset via a genuine
// fresh page load (new JS context) or flip true via an explicit user action in this session —
// never gets permanently "stuck".
let _modalShownThisSession = false;
let _bannerDismissedThisSession = false;

/** Also called from SettingsPage when the user manually flips the toggle off. */
export function markBubbleDismissedThisSession() {
  _modalShownThisSession = true;
  _bannerDismissedThisSession = true;
}

function BubbleOnboardingModal({ onNotNow, onEnable }: { onNotNow: () => void; onEnable: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onNotNow(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable Floating Brain</DialogTitle>
          <DialogDescription>
            Access ContextOS instantly while browsing. Enable the floating Brain button to
            save and view your context anywhere.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onNotNow}>Later</Button>
          <Button onClick={onEnable}>Enable Now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BubbleReminderBanner({ onEnable, onLater }: { onEnable: () => void; onLater: () => void }) {
  return (
    <div className="bg-brand-500/10 border-b border-brand-500/30 px-4 py-2 flex items-center justify-between gap-4 text-sm flex-wrap">
      <span className="text-brand-700 dark:text-brand-600">
        Floating Brain is disabled. Enable it for instant access.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={onEnable}>Enable Now</Button>
        <Button size="sm" variant="ghost" onClick={onLater}>Later</Button>
      </div>
    </div>
  );
}

/**
 * Mount once inside the signed-in app shell (see AppLayout.tsx). Always re-checks the real
 * device permission status (via useBubbleExtension, backed by the native bridge) on mount,
 * on sign-in, and on every resume/focus — never trusts a cached "was enabled" flag.
 */
export function BubbleExtensionPrompts() {
  const { isSignedIn, userId } = useAuthContext();
  const { isSupported, status, refresh, enable } = useBubbleExtension();
  const [, bump] = useState(0);
  const forceRender = () => bump((n) => n + 1);

  // Re-check the moment sign-in completes, in addition to the hook's own mount/visibility/
  // focus checks — covers sign-in happening without a full page navigation.
  useEffect(() => {
    if (isSignedIn) refresh();
  }, [isSignedIn, refresh]);

  useEffect(() => {
    document.addEventListener("visibilitychange", forceRender);
    window.addEventListener("focus", forceRender);
    return () => {
      document.removeEventListener("visibilitychange", forceRender);
      window.removeEventListener("focus", forceRender);
    };
  }, []);

  if (!isSupported || !isSignedIn || !userId || status === "enabled") return null;

  if (!_modalShownThisSession) {
    return (
      <BubbleOnboardingModal
        onNotNow={() => { markBubbleDismissedThisSession(); forceRender(); }}
        onEnable={() => { _modalShownThisSession = true; enable(); forceRender(); }}
      />
    );
  }

  if (!_bannerDismissedThisSession) {
    return (
      <BubbleReminderBanner
        onEnable={enable}
        onLater={() => { _bannerDismissedThisSession = true; forceRender(); }}
      />
    );
  }

  return null;
}
