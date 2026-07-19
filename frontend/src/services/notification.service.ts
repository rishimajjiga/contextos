/**
 * notification.service.ts
 * Client for the user-facing notification inbox. These routes are NOT
 * founder-gated — every signed-in user reads their own inbox, scoped by the
 * backend from the Clerk user id (see api/v1/endpoints/inbox.py).
 *
 * Deliberately a thin wrapper over the endpoints that already exist; no new
 * notification system, no duplicate state store.
 */
import { apiClient } from "./api";

export type NotificationType =
  | "update"
  | "announcement"
  | "feature"
  | "maintenance"
  | "warning";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  created_at: string;
  read: boolean;
}

export interface NotificationInbox {
  notifications: AppNotification[];
  unread: number;
}

export const notificationService = {
  /** GET /inbox/notifications — audience filtering happens server-side. */
  async list(): Promise<NotificationInbox> {
    const { data } = await apiClient.get("/inbox/notifications");
    return {
      notifications: data?.notifications ?? [],
      unread: data?.unread ?? 0,
    };
  },

  /**
   * POST /inbox/notifications/{id}/read — idempotent on the backend, so
   * calling it twice for the same notification is harmless.
   */
  async markRead(id: string): Promise<void> {
    await apiClient.post(`/inbox/notifications/${id}/read`);
  },
};
