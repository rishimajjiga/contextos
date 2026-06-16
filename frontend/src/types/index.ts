// Domain Types

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  role: string;
  skills: string[];
  tone: ProfileTone;
  response_style: ResponseStyle;
  programming_languages: string[];
  frameworks: string[];
  created_at: string;
  updated_at: string;
}

export type ProfileTone = "professional" | "casual" | "concise" | "detailed";
export type ResponseStyle = "technical" | "conversational" | "bullet-points" | "narrative";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  stack: string[];
  goals: string;
  architecture: string;
  coding_style: string;
  active_tasks: string[];
  current_problems: string[];
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string | null;
  user_id: string;
  title: string;
  content: string;
  doc_type: DocumentType;
  file_url: string | null;
  tags: string[];
  visibility: "private" | "team";
  created_at: string;
  updated_at: string;
}

export type DocumentType = "note" | "pdf" | "code" | "research" | "other";

export interface SearchResult {
  id: string;
  type: "document" | "project" | "profile";
  title: string;
  content: string;
  similarity: number | null;
  project_id?: string;
  project_name?: string;
  doc_type?: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  tool_name: string;
  last_used: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
}

export interface ApiKeyCreated extends ApiKey {
  key: string;
}

export interface CreateApiKeyPayload {
  name: string;
}

// API Response Types

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}

// Form Types

export interface CreateProfilePayload {
  role: string;
  skills: string[];
  tone: ProfileTone;
  response_style: ResponseStyle;
  programming_languages: string[];
  frameworks: string[];
}

export interface UpdateProfilePayload extends Partial<CreateProfilePayload> {}

export interface CreateProjectPayload {
  name: string;
  description: string;
  stack: string[];
  goals: string;
  architecture: string;
  coding_style: string;
  active_tasks: string[];
  current_problems: string[];
}

export interface UpdateProjectPayload extends Partial<CreateProjectPayload> {}

export interface CreateDocumentPayload {
  title: string;
  content: string;
  doc_type: DocumentType;
  project_id?: string;
  tags: string[];
}

export interface UpdateDocumentPayload extends Partial<CreateDocumentPayload> {
  visibility?: "private" | "team";
}

export interface SearchPayload {
  query: string;
  limit?: number;
  project_id?: string;
  doc_types?: DocumentType[];
}
