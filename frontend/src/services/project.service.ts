import { request } from "./api";
import type {
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  PaginatedResponse,
} from "@/types";

export const projectService = {
  async listProjects(page = 1, perPage = 20): Promise<PaginatedResponse<Project>> {
    return request({
      method: "GET",
      url: "/projects",
      params: { page, per_page: perPage },
    });
  },

  async getProject(id: string): Promise<Project> {
    return request({ method: "GET", url: `/projects/${id}` });
  },

  async createProject(payload: CreateProjectPayload): Promise<Project> {
    return request({ method: "POST", url: "/projects", data: payload });
  },

  async updateProject(id: string, payload: UpdateProjectPayload): Promise<Project> {
    return request({ method: "PATCH", url: `/projects/${id}`, data: payload });
  },

  async deleteProject(id: string): Promise<void> {
    return request({ method: "DELETE", url: `/projects/${id}` });
  },
};
