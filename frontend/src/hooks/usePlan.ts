import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { billingService, type PlanInfo } from "@/services/billing.service";

/**
 * Global subscription state.
 *
 * One source of truth shared by every `usePlan()` consumer (module-level
 * singleton), so the app fetches the plan once — not once per component — and
 * every page reuses it instantly when navigating.
 *
 * Key behaviours (UX requirements):
 *  - NEVER defaults to "Free". `plan` is `null` until the real plan is known,
 *    so consumers show a loading/skeleton state instead of flashing Free.
 *  - Per-user localStorage cache: on a return visit the correct plan renders
 *    immediately and is refreshed silently in the background (no flicker).
 *  - Deduped fetches + a staleness window so navigating pages doesn't spam the
 *    API; a forced `refetch()` is available after payments/cancellations.
 *  - Cache is keyed by user id, so user A's plan can never show for user B.
 *
 * Backward compatible: the returned shape still includes `{ plan, isLoading,
 * refetch }`; `plan` is now `PlanInfo | null` (was always Free-defaulted).
 */

const CACHE_PREFIX = "ctxos:plan:";
const STALE_MS = 60_000; // background-refresh at most once per minute per surface

// ── Module-level singleton ────────────────────────────────────────────────────
let _plan: PlanInfo | null = null;
let _userId: string | null = null; // which user _plan belongs to
let _lastFetch = 0;
let _inflight: Promise<void> | null = null;
const _subs = new Set<() => void>();
const _notify = () => _subs.forEach((fn) => fn());

function _readCache(uid: string): PlanInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + uid);
    return raw ? (JSON.parse(raw) as PlanInfo) : null;
  } catch {
    return null;
  }
}

function _writeCache(uid: string, p: PlanInfo) {
  try {
    localStorage.setItem(CACHE_PREFIX + uid, JSON.stringify(p));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

async function _fetch(uid: string, force = false): Promise<void> {
  if (_inflight && !force) return _inflight; // dedupe concurrent callers
  _notify();
  _inflight = (async () => {
    try {
      const data = await billingService.getPlan();
      _plan = data;
      _userId = uid;
      _lastFetch = Date.now();
      _writeCache(uid, data);
    } catch {
      // Keep whatever we already have (cache). NEVER downgrade to Free on a
      // transient error — that would display an incorrect plan.
    } finally {
      _inflight = null;
      _notify();
    }
  })();
  return _inflight;
}

export function usePlan() {
  const { user } = useUser();
  const uid = user?.id ?? null;
  const [, rerender] = useState(0);

  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    _subs.add(cb);

    if (uid) {
      if (_userId !== uid) {
        // Different (or first) user: hydrate from THAT user's cache so the
        // correct plan can render immediately, then refresh in the background.
        _plan = _readCache(uid);
        _userId = uid;
        _lastFetch = 0;
        _notify();
        _fetch(uid);
      } else if (_plan === null) {
        // Same user, nothing cached yet → initial load.
        if (!_inflight) _fetch(uid);
      } else if (Date.now() - _lastFetch >= STALE_MS) {
        // Same user, have data, but it's stale → silent background refresh.
        if (!_inflight) _fetch(uid);
      }
    }

    return () => {
      _subs.delete(cb);
    };
  }, [uid]);

  const refetch = useCallback(
    () => (uid ? _fetch(uid, true) : Promise.resolve()),
    [uid],
  );

  const isResolved = _plan !== null && _userId === uid;

  return {
    plan: isResolved ? _plan : null,
    // Loading only while signed in and the real plan isn't known yet.
    isLoading: uid ? !isResolved : false,
    isResolved,
    refetch,
  };
}
