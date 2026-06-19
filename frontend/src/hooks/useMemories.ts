import { useState, useCallback } from "react";
import { memoryService, type Memory, type CreateMemoryPayload } from "@/services/memory.service";

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = useCallback(async (params?: { projectId?: string; q?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await memoryService.list(params);
      setMemories(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load memories.");
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createMemory = useCallback(async (payload: CreateMemoryPayload): Promise<Memory | null> => {
    setIsSaving(true);
    setError(null);
    try {
      const created = await memoryService.create(payload);
      setMemories((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      setError(err?.message || "Failed to save memory.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteMemory = useCallback(async (id: string) => {
    try {
      await memoryService.delete(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      setError(err?.message || "Failed to delete memory.");
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { memories, isLoading, isSaving, error, clearError, fetchMemories, createMemory, deleteMemory };
}
