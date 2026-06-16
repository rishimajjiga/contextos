import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";

// Base Axios Instance

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
});

// Auth Token Injection
// Called once from AuthContext after Clerk loads to attach token on every request.

let getTokenFn: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

apiClient.interceptors.request.use(async (config) => {
  if (getTokenFn) {
    const token = await getTokenFn();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Error Normalization
// 402 responses carry a structured {code, resource, limit, plan, message} detail.
// Re-throw them as LimitError so the UI can detect them and show UpgradeModal.

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
    if (error.response?.status === 402) {
      const detail = error.response.data?.detail;
      if (detail?.code === "LIMIT_REACHED") {
        return Promise.reject(new LimitError(detail));
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
        : rawDetail?.message || error.message || "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

// Generic Request Helper

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.request<T>(config);
  return response.data;
}
