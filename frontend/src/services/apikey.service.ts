import { request } from "./api";
import type { ApiKey, ApiKeyCreated, CreateApiKeyPayload } from "@/types";

export const apiKeyService = {
  async listKeys(): Promise<ApiKey[]> {
    return request({ method: "GET", url: "/api-keys" });
  },

  async createKey(payload: CreateApiKeyPayload): Promise<ApiKeyCreated> {
    return request({ method: "POST", url: "/api-keys", data: payload });
  },

  async revokeKey(id: string): Promise<void> {
    return request({ method: "DELETE", url: `/api-keys/${id}` });
  },
};
