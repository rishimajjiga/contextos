import { request } from "./api";
import type { SearchResult, SearchPayload } from "@/types";

export const searchService = {
  async search(payload: SearchPayload): Promise<SearchResult[]> {
    return request({ method: "POST", url: "/search", data: payload });
  },
};
