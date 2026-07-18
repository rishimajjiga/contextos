/**
 * founder.service.ts
 * Client for the Founder Panel API. Every call hits a backend route guarded by
 * require_founder — a non-founder gets 403 no matter what the UI shows.
 */
import { apiClient } from "./api";

export const PLANS = ["free", "student", "pro", "team"] as const;
export const DURATIONS = [
  { key: "7d", label: "7 Days" },
  { key: "15d", label: "15 Days" },
  { key: "1m", label: "1 Month" },
  { key: "2m", label: "2 Months" },
  { key: "3m", label: "3 Months" },
  { key: "1y", label: "1 Year" },
] as const;
export const NOTIFICATION_TYPES = ["update", "announcement", "feature", "maintenance", "warning"] as const;
export const AUDIENCES = ["everyone", "free", "student", "pro", "team", "selected"] as const;
export const COMPENSATION_REASONS = [
  "Website bug", "Payment issue", "Server downtime", "Login issue", "Beta testing reward",
] as const;

export const founderService = {
  async access(): Promise<boolean> {
    try {
      const { data } = await apiClient.get("/inbox/founder-access");
      return !!data.is_founder;
    } catch {
      return false;
    }
  },
  async dashboard() {
    return (await apiClient.get("/founder/dashboard")).data;
  },
  async searchUsers(q: string) {
    return (await apiClient.get("/founder/users/search", { params: { q } })).data.users;
  },
  async userDetail(userId: string) {
    return (await apiClient.get(`/founder/users/${userId}`)).data;
  },
  async grant(body: { user_id: string; plan: string; duration: string; reason: string; mode?: string; category?: string }) {
    return (await apiClient.post("/founder/users/grant", body)).data;
  },
  async compensate(body: { user_id: string; plan: string; duration: string; reason: string }) {
    return (await apiClient.post("/founder/users/compensate", body)).data;
  },
  async removeGrant(grant_id: string, reason: string) {
    return (await apiClient.post("/founder/users/remove-grant", { grant_id, reason })).data;
  },
  async activityLog() {
    return (await apiClient.get("/founder/activity-log")).data.entries;
  },
  async listNotifications() {
    return (await apiClient.get("/founder/notifications")).data.notifications;
  },
  async createNotification(body: any) {
    return (await apiClient.post("/founder/notifications", body)).data;
  },
  async listBanners() {
    return (await apiClient.get("/founder/banners")).data.banners;
  },
  async createBanner(body: any) {
    return (await apiClient.post("/founder/banners", body)).data;
  },
  async toggleBanner(id: string, enabled: boolean) {
    return (await apiClient.patch(`/founder/banners/${id}`, { enabled })).data;
  },
  async listTickets(status?: string) {
    return (await apiClient.get("/founder/support-tickets", { params: status ? { status } : {} })).data.tickets;
  },
  async updateTicket(id: string, status: string, resolution_note?: string) {
    return (await apiClient.patch(`/founder/support-tickets/${id}`, { status, resolution_note })).data;
  },
  async analytics() {
    return (await apiClient.get("/founder/analytics")).data;
  },
};
