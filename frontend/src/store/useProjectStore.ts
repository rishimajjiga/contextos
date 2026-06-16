import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Project } from "@/types";

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  total: number;
  setProjects: (projects: Project[], total: number) => void;
  setSelectedProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set) => ({
      projects: [],
      selectedProject: null,
      isLoading: false,
      error: null,
      total: 0,
      setProjects: (projects, total) => set({ projects, total }),
      setSelectedProject: (selectedProject) => set({ selectedProject }),
      addProject: (project) =>
        set((state) => ({
          projects: [project, ...state.projects],
          total: state.total + 1,
        })),
      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
          selectedProject:
            state.selectedProject?.id === id
              ? { ...state.selectedProject, ...updates }
              : state.selectedProject,
        })),
      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          total: state.total - 1,
        })),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      reset: () =>
        set({ projects: [], selectedProject: null, isLoading: false, error: null, total: 0 }),
    }),
    { name: "ProjectStore" }
  )
);
