import { apiClient } from "./api";

export interface Memory {
  id: string;
  title: string;
  content: string;
  tags: string[];
  project_id: string | null;
  visibility?: "private" | "team";
  created_at: string;
  updated_at: string;
}

export interface CreateMemoryPayload {
  title: string;
  content: string;
  tags?: string[];
  project_id?: string;
  visibility?: "private" | "team";
}

export const memoryService = {
  async list(params?: { projectId?: string; q?: string }): Promise<Memory[]> {
    const p = new URLSearchParams();
    if (params?.projectId) p.set("project_id", params.projectId);
    if (params?.q?.trim())  p.set("q", params.q.trim());
    const qs = p.toString() ? `?${p.toString()}` : "";
    const res = await apiClient.get<Memory[]>(`/memories${qs}`);
    return res.data;
  },

  async create(payload: CreateMemoryPayload): Promise<Memory> {
    const res = await apiClient.post<Memory>("/memories", payload);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/memories/${id}`);
  },
};
