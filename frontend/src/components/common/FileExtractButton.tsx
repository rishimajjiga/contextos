// ── FileExtractButton · small secondary "Upload file" → extracted text ──────
// Deliberately quiet UI: the main action stays "create a memory". This is not
// file storage — files are read in the browser, the text is extracted, and
// the file is discarded. Only the text goes on to become a memory.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractTextFromFile, type ExtractedFile } from "@/lib/extractText";

const ACCEPT = ".pdf,.doc,.docx,.txt,.md";

export function FileExtractButton({
  onExtracted,
  size = "sm",
}: {
  onExtracted: (result: ExtractedFile) => void;
  size?: "sm" | "default";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    try {
      const result = await extractTextFromFile(file);
      onExtracted(result);
      toast.success("Your file has been converted into a memory draft.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't extract text from this file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = ""; // allow re-selecting the same file
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="gap-1.5"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? "Extracting…" : "Upload file"}
      </Button>
    </>
  );
}

/** The standard privacy note shown near every upload button. */
export function FileExtractNote() {
  return (
    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
      ContextOS does not store your uploaded files. We only extract the text content and save it
      as a memory — your original file is not saved.
    </p>
  );
}
