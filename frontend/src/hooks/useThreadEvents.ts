import { useState, useCallback } from "react";
import { threadService, type ThreadEvent } from "@/services/thread.service";

export function useThreadEvents(projectId?: string) {
  const [events, setEvents] = useState<ThreadEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThread = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await threadService.getThread(projectId);
      setEvents(data.events);
      setTotal(data.total);
    } catch (err) {
      setError("Failed to load thread");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  return { events, total, isLoading, error, fetchThread };
}
