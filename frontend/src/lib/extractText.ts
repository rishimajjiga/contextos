// ── extractText · client-side file → raw text extraction ────────────────────
// Purpose: "a document is only a source — the memory is the valuable part."
// Files NEVER leave the browser and are NEVER uploaded or stored anywhere:
// extraction happens entirely client-side, then only the extracted text is
// saved as a normal ContextOS memory through the existing memories API.
//
// PDF and DOCX parsers are loaded on demand from cdnjs (pdf.js / mammoth), so
// the app bundle stays unchanged and nothing loads unless a user extracts.

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const MAMMOTH_URL = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";

const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = loaded.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loaded.delete(src);
      reject(new Error("Couldn't load the file reader. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  loaded.set(src, p);
  return p;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    pdfjsLib?: any;
    mammoth?: any;
  }
}

async function extractPdf(buf: ArrayBuffer): Promise<string> {
  await loadScript(PDFJS_URL);
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) throw new Error("Couldn't load the PDF reader. Please try again.");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it: any) => it.str ?? "").join(" "));
  }
  await doc.destroy?.();
  return pages.join("\n\n").trim();
}

async function extractDocx(buf: ArrayBuffer): Promise<string> {
  await loadScript(MAMMOTH_URL);
  const mammoth = window.mammoth;
  if (!mammoth) throw new Error("Couldn't load the document reader. Please try again.");
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return String(result?.value ?? "").trim();
}

// Legacy binary .doc has no reliable browser parser — salvage readable runs
// (like the unix `strings` tool). If too little comes out, ask for docx/pdf.
function extractLegacyDoc(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  let run = "";
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) {
      run += String.fromCharCode(c);
    } else {
      if (run.length >= 5) out += run + "\n";
      run = "";
    }
  }
  if (run.length >= 5) out += run;
  // Drop obvious junk lines (mostly symbols / no letters)
  const text = out
    .split("\n")
    .filter((l) => (l.match(/[A-Za-z]/g)?.length ?? 0) > l.length * 0.5)
    .join("\n")
    .trim();
  if (text.length < 40) {
    throw new Error("Couldn't extract readable text from this .doc file. Try saving it as .docx or PDF and upload again.");
  }
  return text;
}

export interface ExtractedFile {
  /** Suggested memory title — the filename without its extension. */
  title: string;
  /** The raw extracted text, exactly as extracted. */
  text: string;
  fileName: string;
}

export async function extractTextFromFile(file: File): Promise<ExtractedFile> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  if (!["pdf", "doc", "docx", "txt", "md"].includes(ext)) {
    throw new Error("Unsupported file type. Upload a PDF, DOC, DOCX, TXT, or Markdown file.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File size exceeds 5 MB. Please upload a smaller file.");
  }

  let text: string;
  if (ext === "txt" || ext === "md") {
    text = (await file.text()).trim();
  } else if (ext === "pdf") {
    text = await extractPdf(await file.arrayBuffer());
  } else if (ext === "docx") {
    text = await extractDocx(await file.arrayBuffer());
  } else {
    text = extractLegacyDoc(await file.arrayBuffer());
  }

  if (!text) {
    throw new Error("No readable text found in this file.");
  }

  const title = file.name.replace(/\.[^.]+$/, "").trim() || file.name;
  return { title, text, fileName: file.name };
}
