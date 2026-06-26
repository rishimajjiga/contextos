import { useState, useCallback, useEffect, useRef } from "react";
import { memoryService, type Memory, type CreateMemoryPayload, type UpdateMemoryPayload } from "@/services/memory.service";

// Custom event name shared with the Chrome extension via website-bridge.js.
// Fired when any memory is saved or deleted — from the website OR the extension.
const SYNC_EVENT = "contextos:memory-saved";

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track the active search params so auto-refresh uses the same filter
  const lastParamsRef = useRef<{ projectId?: string; q?: string; scope?: "personal" | "team" | "all" } | undefined>(undefined);

  const fetchMemories = useCallback(async (params?: { projectId?: string; q?: string; scope?: "personal" | "team" | "all" }) => {
    lastParamsRef.current = params;
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
      // Notify extension (via website-bridge.js) to invalidate its cache
      window.dispatchEvent(new CustomEvent(SYNC_EVENT));
      return created;
    } catch (err: any) {
      setError(err?.message || "Failed to save memory.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateMemory = useCallback(async (id: string, payload: UpdateMemoryPayload): Promise<Memory | null> => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await memoryService.update(id, payload);
      // Replace in place — same id, no duplicate row created.
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
      window.dispatchEvent(new CustomEvent(SYNC_EVENT));
      return updated;
    } catch (err: any) {
      setError(err?.message || "Failed to update memory.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteMemory = useCallback(async (id: string) => {
    try {
      await memoryService.delete(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    } catch (err: any) {
      setError(err?.message || "Failed to delete memory.");
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Listen for saves from the Chrome extension so this component auto-refreshes
  // without requiring a page reload. website-bridge.js dispatches this event
  // when chrome.storage.local.lastSave changes (set by background.js after save).
  useEffect(() => {
    const handler = () => {
      // Re-fetch with whatever params were active at the time
      fetchMemories(lastParamsRef.current);
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, [fetchMemories]);

  return { memories, isLoading, isSaving, error, clearError, fetchMemories, createMemory, updateMemory, deleteMemory };
}
