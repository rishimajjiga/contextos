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

apiClient.interceptors.request.use(async (config) => {
  if (getTokenFn) {
    try {
      const token = await getTokenFn();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (err) {
      console.error("[api] getToken() failed:", err);
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
