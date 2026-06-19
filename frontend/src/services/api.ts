import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
  (error: AxiosError<any>) => {
    if (!error.response) {
      return Promise.reject(
        new Error("Can't reach the server. Please try again in a moment.")
      );
    }
    if (error.response.status === 402) {
      const detail = error.response.data?.detail;
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
