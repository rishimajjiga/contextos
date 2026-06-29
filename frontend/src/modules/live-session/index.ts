// ── Live Session module · public surface ─────────────────────────────────────
// The ONLY symbol the host app needs. Import and drop into the nav:
//
//   import { LiveSessionButton } from "@/modules/live-session";
//   ...
//   <LiveSessionButton />
//
// Everything else (panel, hooks, Supabase client) is internal to the module.

export { LiveSessionButton } from "./components/LiveSessionButton";
export { isLiveConfigured } from "./lib/supabaseClient";
