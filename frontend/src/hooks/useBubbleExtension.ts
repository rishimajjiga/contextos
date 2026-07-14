import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    ContextOSNative?: {
      isNativeApp: () => boolean;
      isBubbleEnabled: () => boolean;
      enableBubble: () => "granted" | "permission_required";
      disableBubble: () => void;
    };
  }
}

export type BubbleStatus = "enabled" | "disabled";

/**
 * Wraps the native `window.ContextOSNative` bridge (Android only today — see
 * WebAppBridge.kt). `isBubbleEnabled()` on the native side self-heals against the
 * overlay permission having been revoked from system Settings, so refreshing on
 * visibility/focus is enough to catch that case, an app resume, and returning from
 * the permission screen — no polling needed.
 */
export function useBubbleExtension() {
  const isSupported = typeof window !== "undefined" && !!window.ContextOSNative?.isNativeApp();
  const [status, setStatus] = useState<BubbleStatus>("disabled");

  const refresh = useCallback(() => {
    if (!isSupported) return;
    setStatus(window.ContextOSNative!.isBubbleEnabled() ? "enabled" : "disabled");
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;
    refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [isSupported, refresh]);

  const enable = useCallback(() => {
    if (!isSupported) return undefined;
    const result = window.ContextOSNative!.enableBubble();
    refresh();
    return result;
  }, [isSupported, refresh]);

  const disable = useCallback(() => {
    if (!isSupported) return;
    window.ContextOSNative!.disableBubble();
    refresh();
  }, [isSupported, refresh]);

  return { isSupported, status, refresh, enable, disable };
}
