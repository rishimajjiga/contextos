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
