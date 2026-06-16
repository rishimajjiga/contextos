import { request } from "./api";
import type { Profile, CreateProfilePayload, UpdateProfilePayload } from "@/types";

export const profileService = {
  async getProfile(): Promise<Profile> {
    return request({ method: "GET", url: "/profile" });
  },

  async createProfile(payload: CreateProfilePayload): Promise<Profile> {
    return request({ method: "POST", url: "/profile", data: payload });
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<Profile> {
    return request({ method: "PATCH", url: "/profile", data: payload });
  },
};
