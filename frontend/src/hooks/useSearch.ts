/**
 * useSearchSuggestions
 * Debounced (150ms) autocomplete suggestions with:
 *   - AbortController: cancels in-flight requests when the user types again
 *   - LRU cache (in search.service): cache hits skip the debounce entirely
 *   - Recent searches: persisted in localStorage, loaded synchronously
 *   - Keyboard navigation state: selectedIndex managed here, not in the UI
 */
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  fetchSuggestions,
  getRecentSearches,
  addRecentSearch   as storeSave,
  removeRecentSearch as storeRemove,
  clearRecentSearches as storeClear,
  type Suggestion,
} from "@/services/search.service";

const SUGGEST_DELAY = 150; // ms — fast enough to feel instant

export interface UseSuggestions {
  suggestions: Suggestion[];
  loadingSuggestions: boolean;
  /** -1 = nothing selected */
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  recentSearches: string[];
  saveSearch: (q: string) => void;
  removeSearch: (q: string) => void;
  clearSearches: () => void;
}

export function useSearchSuggestions(query: string): UseSuggestions {
  const [suggestions, setSuggestions]         = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoading]      = useState(false);
  const [selectedIndex, setSelectedIndex]     = useState(-1);
  const [recentSearches, setRecentSearches]   = useState<string[]>(getRecentSearches);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset keyboard selection whenever the suggestion list changes
  useEffect(() => { setSelectedIndex(-1); }, [suggestions]);

  useEffect(() => {
    // Cancel any pending timer and any in-flight request immediately
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();

    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    // Show the spinner immediately (before the debounce fires) so the UI
    // feels responsive even before any results arrive.
    setLoading(true);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const results = await fetchSuggestions(trimmed, controller.signal);
        if (!controller.signal.aborted) {
          setSuggestions(results);
        }
      } catch (err) {
        // Silently swallow cancellations (user typed again before this resolved)
        if (!axios.isCancel(err) && (err as Error)?.name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, SUGGEST_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [query]);

  const saveSearch   = useCallback((q: string) => setRecentSearches(storeSave(q)),   []);
  const removeSearch = useCallback((q: string) => setRecentSearches(storeRemove(q)), []);
  const clearSearches = useCallback(()          => setRecentSearches(storeClear()),  []);

  return {
    suggestions,
    loadingSuggestions,
    selectedIndex,
    setSelectedIndex,
    recentSearches,
    saveSearch,
    removeSearch,
    clearSearches,
  };
}
