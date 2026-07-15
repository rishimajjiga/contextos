import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "";  // empty = relative URL, proxied via Vercel to Railway

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

let getTokenFn: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

// Every request gets a short correlation id so a failure can be matched between
// this browser console, the backend's structured logs (LoggingMiddleware echoes
// X-Request-Id), and a bug report — without ever needing to show the user
// (or log) the raw Clerk/axios error object itself.
function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

apiClient.interceptors.request.use(async (config) => {
  const requestId = newRequestId();
  config.headers["X-Request-Id"] = requestId;
  (config as any).__requestId = requestId;

  if (getTokenFn) {
    try {
      const token = await getTokenFn();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn(`[auth:${requestId}] getToken() returned no token for ${config.method?.toUpperCase()} ${config.url} — request will go out unauthenticated and the backend should reject it with a clean 401.`);
      }
    } catch (err: any) {
      // This is the exact failure point for the Clerk dev-instance session-sync
      // issue: Clerk's own getToken() call rejects with Clerk's raw API error
      // (the {"errors":[...],"clerk_trace_id":...} shape). Log every field we
      // can to the console for debugging, but never let that raw object reach
      // a UI-facing catch block — the request just proceeds without a token,
      // so the backend's 401 (handled below) is the single place the user-facing
      // "please sign in again" flow triggers.
      console.error(`[auth:${requestId}] Clerk getToken() failed for ${config.method?.toUpperCase()} ${config.url}`, {
        clerkErrorCode: err?.errors?.[0]?.code,
        clerkErrorMessage: err?.errors?.[0]?.message,
        clerkTraceId: err?.clerk_trace_id ?? err?.clerkTraceId,
        rawError: err,
      });
    }
  }
  return config;
});

export class LimitError extends Error {
  code = "LIMIT_REACHED";
  resource: string;
  limit: number;
  plan: string;

  constructor(detail: { resource: string; limit: number; plan: string; message: string }) {
    super(detail.message);
    this.resource = detail.resource;
    this.limit = detail.limit;
    this.plan = detail.plan;
  }
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<any>) => {
    const cfg = error.config as any;

    // ── Auto-retry once on transient failures (network error OR 5xx) ──────────
    // This silently handles Railway cold starts and brief Supabase hiccups.
    // We mark the config so we never retry more than once per request.
    if (cfg && !cfg.__retried) {
      const isTransient = !error.response || error.response.status >= 500;
      if (isTransient) {
        cfg.__retried = true;
        await new Promise((r) => setTimeout(r, 1500));
        try {
          return await apiClient.request(cfg);
        } catch (retryErr) {
          // Use the retry error for the rest of the handler below
          error = retryErr as AxiosError<any>;
        }
      }
    }

    if (!error.response) {
      console.error("[api] No response – raw error:", error);
      console.error("[api] error.message:", error.message);
      console.error("[api] error.code:", error.code);
      console.error("[api] request URL:", cfg?.url, "baseURL:", cfg?.baseURL);
      return Promise.reject(
        new Error(error.message || "Unable to reach the server. Please try again in a moment.")
      );
    }

    const detail = error.response.data?.detail;

    // 401 — the Clerk session token this request carried was missing/expired/invalid.
    // Previously this fell through to the generic branch below and surfaced whatever
    // raw detail the server (or an upstream service) returned, which is how a raw
    // Clerk-shaped error body could end up on screen. Send the user back to sign-in
    // with a clear message instead of showing them a bare error payload.
    if (error.response.status === 401) {
      console.error(`[auth:${cfg?.__requestId ?? "?"}] 401 from ${cfg?.method?.toUpperCase()} ${cfg?.url} — backend detail: ${JSON.stringify(detail)}`);
      const e: any = new Error("Your session has expired. Please sign in again.");
      e.code = "SESSION_EXPIRED";
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/sign-in")) {
        window.location.href = "/sign-in";
      }
      return Promise.reject(e);
    }

    if (error.response.status === 402) {
      if (detail?.code === "LIMIT_REACHED") {
        return Promise.reject(new LimitError(detail));
      }
      if (detail?.code === "GRACE_PERIOD") {
        const e: any = new Error(
          detail.message || "Subscription expired - data is read-only."
        );
        e.code = "GRACE_PERIOD";
        e.days_left = detail.days_left;
        return Promise.reject(e);
      }
      if (detail?.code === "TEAM_PLAN_REQUIRED") {
        const e: any = new Error(detail.message || "Team plan required.");
        e.code = "TEAM_PLAN_REQUIRED";
        return Promise.reject(e);
      }
    }

    // 410 Gone — grace period ended, data was deleted
    if (error.response.status === 410 && detail?.code === "DATA_DELETED") {
      const e: any = new Error(
        detail.message || "Your data has been permanently deleted."
      );
      e.code = "DATA_DELETED";
      return Promise.reject(e);
    }

    // 5xx — prefer the backend's own detail message (e.g. "Razorpay error: …",
    // "Could not fetch your account details.") and only fall back to a generic
    // string when the server sent no readable detail.
    if (error.response.status >= 500) {
      const serverDetail = error.response?.data?.detail;
      const msg =
        typeof serverDetail === "string" && serverDetail.length > 0
          ? serverDetail
          : "Server error. Please try again in a few moments.";
      return Promise.reject(new Error(msg));
    }

    const rawDetail = error.response?.data?.detail;
    const message =
      typeof rawDetail === "string"
        ? rawDetail
        : Array.isArray(rawDetail)
        ? "Validation error: " + rawDetail.map((e: any) => e.msg).join("; ")
        : rawDetail?.message || error.message || "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.request<T>(config);
  return response.data;
}
