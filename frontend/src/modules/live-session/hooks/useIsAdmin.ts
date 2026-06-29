// ── Live Session module · admin check ────────────────────────────────────────
// Reads the signed-in Clerk email (if any) and compares to ADMIN_EMAIL.
// Anonymous visitors are simply non-admin — the panel still works for them.

import { useUser } from "@clerk/clerk-react";
import { ADMIN_EMAIL } from "../config";

export function useIsAdmin(): { isAdmin: boolean; email: string | null } {
  // useUser is safe to call even when signed out (returns isSignedIn=false).
  const { user, isSignedIn } = useUser();
  const email = isSignedIn ? user?.primaryEmailAddress?.emailAddress ?? null : null;
  const isAdmin = !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  return { isAdmin, email };
}
