import { useCallback, useState } from "react";
import { toast } from "sonner";
import { documentService } from "@/services/document.service";
import { LimitError } from "@/services/api";
import type { Document, CreateDocumentPayload, UpdateDocumentPayload } from "@/types";

interface DocumentState {
  documents: Document[];
  total: number;
  isLoading: boolean;
  isUploading: boolean;
}

export function useDocuments(projectId?: string) {
  const [state, setState] = useState<DocumentState>({
    documents: [],
    total: 0,
    isLoading: false,
    isUploading: false,
  });

  const fetchDocuments = useCallback(async (page = 1) => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const data = await documentService.listDocuments(page, 20, projectId);
      setState(s => ({ ...s, documents: data.items, total: data.total }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load documents";
      toast.error(msg);
    } finally {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, [projectId]);

  const createDocument = useCallback(async (payload: CreateDocumentPayload) => {
    try {
      const doc = await documentService.createDocument(payload);
      setState(s => ({ ...s, documents: [doc, ...s.documents], total: s.total + 1 }));
      toast.success("Document saved");
      return doc;
    } catch (err: unknown) {
      // LimitError — let the caller show the upgrade modal, no toast here
      if (err instanceof LimitError) throw err;
      const msg = err instanceof Error ? err.message : "Failed to create document";
      toast.error(msg);
      throw err;
    }
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    setState(s => ({ ...s, isUploading: true }));
    try {
      const doc = await documentService.uploadFile(file, projectId);
      setState(s => ({ ...s, documents: [doc, ...s.documents], total: s.total + 1 }));
      toast.success(`"${file.name}" uploaded and indexed`);
      return doc;
    } catch (err: unknown) {
      // LimitError — let the caller show the upgrade modal, no toast here
      if (err instanceof LimitError) throw err;
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
      throw err;
    } finally {
      setState(s => ({ ...s, isUploading: false }));
    }
  }, [projectId]);

  const deleteDocument = useCallback(async (id: string) => {
    try {
      await documentService.deleteDocument(id);
      setState(s => ({
        ...s,
        documents: s.documents.filter(d => d.id !== id),
        total: s.total - 1,
      }));
      toast.success("Document deleted");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete document";
      toast.error(msg);
      throw err;
    }
  }, []);

  const updateDocument = useCallback(async (id: string, payload: UpdateDocumentPayload) => {
    try {
      const updated = await documentService.updateDocument(id, payload);
      setState(s => ({
        ...s,
        documents: s.documents.map(d => d.id === id ? updated : d),
      }));
      toast.success("Document updated");
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update document";
      toast.error(msg);
      throw err;
    }
  }, []);

  return {
    ...state,
    fetchDocuments,
    createDocument,
    uploadFile,
    deleteDocument,
    updateDocument,
  };
}
