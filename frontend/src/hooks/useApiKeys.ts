import { useCallback, useState } from "react";
import { toast } from "sonner";
import { apiKeyService } from "@/services/apikey.service";
import type { ApiKey, ApiKeyCreated } from "@/types";

interface ApiKeyState {
  keys: ApiKey[];
  isLoading: boolean;
  newKey: ApiKeyCreated | null; // held until user dismisses the reveal modal
}

export function useApiKeys() {
  const [state, setState] = useState<ApiKeyState>({
    keys: [],
    isLoading: false,
    newKey: null,
  });

  const fetchKeys = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const keys = await apiKeyService.listKeys();
      setState(s => ({ ...s, keys }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  const createKey = useCallback(async (name: string) => {
    try {
      const created = await apiKeyService.createKey({ name });
      setState(s => ({
        ...s,
        keys: [created, ...s.keys],
        newKey: created,
      }));
      toast.success("API key created");
      return created;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create API key");
      throw err;
    }
  }, []);

  const revokeKey = useCallback(async (id: string) => {
    try {
      await apiKeyService.revokeKey(id);
      setState(s => ({ ...s, keys: s.keys.filter(k => k.id !== id) }));
      toast.success("API key revoked");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke API key");
      throw err;
    }
  }, []);

  const dismissNewKey = useCallback(() => {
    setState(s => ({ ...s, newKey: null }));
  }, []);

  return { ...state, fetchKeys, createKey, revokeKey, dismissNewKey };
}
