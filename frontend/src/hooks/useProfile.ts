import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { profileService } from "@/services/profile.service";
import { useProfileStore } from "@/store/useProfileStore";
import type { CreateProfilePayload, UpdateProfilePayload } from "@/types";

export function useProfile() {
  const { profile, isLoading, error, setProfile, setLoading, setError } = useProfileStore();

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await profileService.getProfile();
      setProfile(data);
    } catch (err: unknown) {
      // 404 = profile not yet created — not an error, just empty
      const msg = err instanceof Error ? err.message : "Failed to load profile";
      if (!msg.includes("404") && !msg.includes("not found")) {
        setError(msg);
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [setProfile, setLoading, setError]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const createProfile = useCallback(
    async (payload: CreateProfilePayload) => {
      setLoading(true);
      try {
        const data = await profileService.createProfile(payload);
        setProfile(data);
        toast.success("Profile created successfully");
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create profile";
        toast.error(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setProfile, setLoading]
  );

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      setLoading(true);
      try {
        const data = await profileService.updateProfile(payload);
        setProfile(data);
        toast.success("Profile updated");
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update profile";
        toast.error(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setProfile, setLoading]
  );

  return { profile, isLoading, error, fetchProfile, createProfile, updateProfile };
}
