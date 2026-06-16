import { request } from "./api";

export interface OrgMember {
  user_id: string;
  role: "owner" | "member";
  name: string;
  email: string;
}

export interface Organization {
  id: string;
  name: string;
  owner_user_id: string;
  members: OrgMember[];
}

export interface InviteResult {
  token: string;
  email: string;
  status: string;
  invite_url: string;
  expires_at: string;
}

export const teamService = {
  async getMyOrg(): Promise<Organization | null> {
    return request({ method: "GET", url: "/organizations" });
  },

  async createOrg(name: string): Promise<Organization> {
    return request({ method: "POST", url: "/organizations", data: { name } });
  },

  async inviteMember(email: string): Promise<InviteResult> {
    return request({ method: "POST", url: "/organizations/invite", data: { email } });
  },

  async getPendingInvites(): Promise<InviteResult[]> {
    return request({ method: "GET", url: "/organizations/invites" });
  },

  async revokeInvite(token: string): Promise<void> {
    return request({ method: "DELETE", url: `/organizations/invites/${token}` });
  },

  async joinOrg(token: string): Promise<Organization> {
    return request({ method: "POST", url: `/organizations/join/${token}` });
  },

  async removeMember(memberUserId: string): Promise<void> {
    return request({ method: "DELETE", url: `/organizations/members/${memberUserId}` });
  },
};
