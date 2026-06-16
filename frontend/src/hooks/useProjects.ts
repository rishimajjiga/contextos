import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { projectService } from "@/services/project.service";
import { useProjectStore } from "@/store/useProjectStore";
import type { CreateProjectPayload, UpdateProjectPayload } from "@/types";

export function useProjects() {
  const {
    projects, selectedProject, isLoading, error, total,
    setProjects, setSelectedProject, addProject, updateProject,
    removeProject, setLoading, setError,
  } = useProjectStore();

  const fetchProjects = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectService.listProjects(page);
      setProjects(data.items, data.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load projects";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [setProjects, setLoading, setError]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const fetchProject = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await projectService.getProject(id);
      setSelectedProject(data);
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load project";
      toast.error(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setSelectedProject, setLoading]);

  const createProject = useCallback(async (payload: CreateProjectPayload) => {
    setLoading(true);
    try {
      const data = await projectService.createProject(payload);
      addProject(data);
      toast.success("Project created");
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create project";
      toast.error(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [addProject, setLoading]);

  const editProject = useCallback(async (id: string, payload: UpdateProjectPayload) => {
    setLoading(true);
    try {
      const data = await projectService.updateProject(id, payload);
      updateProject(id, data);
      toast.success("Project updated");
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update project";
      toast.error(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateProject, setLoading]);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await projectService.deleteProject(id);
      removeProject(id);
      toast.success("Project deleted");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete project";
      toast.error(msg);
      throw err;
    }
  }, [removeProject]);

  return {
    projects, selectedProject, isLoading, error, total,
    fetchProjects, fetchProject, createProject, editProject, deleteProject,
  };
}
