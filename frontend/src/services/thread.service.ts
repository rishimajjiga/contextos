import { request } from "./api";

export interface ThreadEvent {
  id: string;
  project_id: string;
  user_id: string;
  event_type: string;
  title: string;
  detail: string;
  created_at: string;
}

export interface ThreadOut {
  events: ThreadEvent[];
  total: number;
}

export const threadService = {
  async getThread(projectId: string, limit = 100, offset = 0): Promise<ThreadOut> {
    return request({
      method: "GET",
      url: `/projects/${projectId}/thread`,
      params: { limit, offset },
    });
  },
};
