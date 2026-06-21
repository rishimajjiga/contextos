/**
 * search.service.ts
 * Cached search + suggestions with proper AbortController support.
 *
 * Caches:
 *   - suggestions: 200 entries, 10 min TTL
 *   - full results: 100 entries,  5 min TTL
 *
 * Both caches use LRU eviction (Map insertion-order property).
 */
import { apiClient } from "./api";

// -- Types ---------------------------------------------------------------------

export interface Suggestion {
  id: string;
  label: string;
  kind: "project" | "memory";
}

export interface SearchProject {
  id: string;
  name: string;
  description: string | null;
  stack: string[];
  kind: "project";
}

export interface SearchMemory {
  id: string;
  title: string;
  content: string;
  tags: string[];
  kind: "memory";
}

export interface SearchResults {
  projects: SearchProject[];
  memories: SearchMemory[];
  total: number;
}

// -- LRU Cache -----------------------------------------------------------------
// Map preserves insertion order. On access we delete-and-reinsert to "freshen"
// the entry. When capacity is reached we delete the first (oldest) entry.

class LRUCache<V> {
  private map = new Map<string, { v: V; exp: number }>();

  constructor(private cap: number, private ttlMs: number) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (Date.now() > e.exp) { this.map.delete(key); return undefined; }
    // Move to end: most-recently-used
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    if (this.map.size >= this.cap) {
      // Evict the oldest (first) entry
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { v: value, exp: Date.now() + this.ttlMs });
  }
}

const TEN_MIN = 10 * 60 * 1000;
const FIVE_MIN =  5 * 60 * 1000;

const suggestCache = new LRUCache<Suggestion[]>(200, TEN_MIN);
const resultCache  = new LRUCache<SearchResults>(100, FIVE_MIN);

// -- Recent searches (localStorage) -------------------------------------------

const RECENT_KEY = "ctos_recent_searches";
const MAX_RECENT = 8;

export function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
  catch { return []; }
}

export function addRecentSearch(q: string): string[] {
  const t = q.trim();
  if (!t) return getRecentSearches();
  const next = [t, ...getRecentSearches().filter(s => s !== t)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function removeRecentSearch(q: string): string[] {
  const next = getRecentSearches().filter(s => s !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentSearches(): string[] {
  localStorage.removeItem(RECENT_KEY);
  return [];
}

// -- API calls -----------------------------------------------------------------

/**
 * Fast prefix-based autocomplete. Cache-first: cache hits bypass the network
 * entirely (no debounce delay, no AbortController needed for those calls).
 * Accepts an AbortSignal so the caller can cancel in-flight requests when
 * the user types again.
 */
export async function fetchSuggestions(
  q: string,
  signal?: AbortSignal,
): Promise<Suggestion[]> {
  const key = q.trim().toLowerCase();
  if (!key) return [];

  const cached = suggestCache.get(key);
  if (cached) return cached;

  const res = await apiClient.get<{ suggestions: Suggestion[]; q: string }>(
    "/search/suggest",
    { params: { q: key, limit: 8 }, signal },
  );

  const suggestions = res.data.suggestions ?? [];
  suggestCache.set(key, suggestions);
  return suggestions;
}

/**
 * Full search. Cache-first. Pass an AbortSignal to cancel when the query
 * changes before the debounce fires the next request.
 */
export async function fetchResults(
  q: string,
  limit = 30,
  signal?: AbortSignal,
): Promise<SearchResults> {
  const key = `${q.trim().toLowerCase()}::${limit}`;

  const cached = resultCache.get(key);
  if (cached) return cached;

  const res = await apiClient.get<SearchResults>(
    "/search",
    { params: { q: q.trim(), limit }, signal },
  );

  resultCache.set(key, res.data);
  return res.data;
}
