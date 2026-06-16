import { request, apiClient } from "./api";
import type {
  Document,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  PaginatedResponse,
} from "@/types";

export const documentService = {
  async listDocuments(
    page = 1,
    perPage = 20,
    projectId?: string
  ): Promise<PaginatedResponse<Document>> {
    return request({
      method: "GET",
      url: "/documents",
      params: { page, per_page: perPage, project_id: projectId },
    });
  },

  async getDocument(id: string): Promise<Document> {
    return request({ method: "GET", url: `/documents/${id}` });
  },

  async createDocument(payload: CreateDocumentPayload): Promise<Document> {
    return request({ method: "POST", url: "/documents", data: payload });
  },

  async updateDocument(id: string, payload: UpdateDocumentPayload): Promise<Document> {
    return request({ method: "PATCH", url: `/documents/${id}`, data: payload });
  },

  async deleteDocument(id: string): Promise<void> {
    return request({ method: "DELETE", url: `/documents/${id}` });
  },

  async uploadFile(file: File, projectId?: string): Promise<Document> {
    const formData = new FormData();
    formData.append("file", file);
    if (projectId) formData.append("project_id", projectId);

    const response = await apiClient.post<Document>("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};
