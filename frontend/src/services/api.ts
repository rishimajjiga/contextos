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
    const token = await getTokenFn();
    if (token) config.headers.Authorization = `Bearer ${token}`;
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
      return Promise.reject(
        new Error("No internet connection. Please check your network and try again.")
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
    if (error.response.status 