import { useCallback, useState } from "react";
import { searchService } from "@/services/search.service";
import type { SearchResult } from "@/types";

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (searchQuery: string, projectId?: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setQuery(searchQuery);
    setIsSearching(true);
    setHasSearched(true);
    try {
      const data = await searchService.search({ query: searchQuery, limit: 20, project_id: projectId });
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setQuery("");
    setHasSearched(false);
  }, []);

  return { results, isSearching, query, hasSearched, search, clearResults };
}
