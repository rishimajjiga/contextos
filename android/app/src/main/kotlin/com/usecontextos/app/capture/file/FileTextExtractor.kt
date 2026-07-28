package com.usecontextos.app.capture.file

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.zip.ZipInputStream

/**
 * Extracts the RAW text of a picked/shared file — nothing added, summarized, or rewritten. The
 * caller saves the returned string verbatim as the memory's content (see FileCaptureHandler).
 *
 * Everything streams straight from the content:// URI: no temporary copy of the original file is
 * ever written to disk, so there is nothing to clean up and the original is never stored — which
 * satisfies (and exceeds) the "delete the temp file / don't store originals" requirement.
 *
 * Type support: TXT (plain read), PDF (PdfBox-Android), DOCX & PPTX (Office Open XML — a zip of
 * XML; text pulled out preserving the document's own paragraph/line/tab breaks, no Apache POI),
 * and images (on-device ML Kit OCR). Bullets, numbering, and code lines survive because the text
 * is read from the source structure, not reflowed.
 */
object FileTextExtractor {

    class EmptyExtraction : Exception("No text found in file")

    private var pdfBoxInited = false

    /** The file's own display name — used as the memory title (a memory can't be created without
     * a title). This is the file's existing name, not a generated/summarized one. */
    fun displayName(context: Context, uri: Uri): String? {
        return try {
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0)?.takeIf { it.isNotBlank() } else null
            }
        } catch (e: Exception) {
            null
        }
    }

    suspend fun extract(context: Context, uri: Uri): String = withContext(Dispatchers.IO) {
        val mime = context.contentResolver.getType(uri).orEmpty().lowercase()
        val name = displayName(context, uri).orEmpty().lowercase()

        val text = when {
            mime == "application/pdf" || name.endsWith(".pdf") -> extractPdf(context, uri)
            isDocx(mime, name) -> extractOfficeXml(context, uri, entryPrefix = "word/", isSlides = false)
            isPptx(mime, name) -> extractOfficeXml(context, uri, entryPrefix = "ppt/slides/", isSlides = true)
            mime.startsWith("image/") || name.matchesImage() -> extractImageOcr(context, uri)
            mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv") ->
                extractPlainText(context, uri)
            // Last-ditch: many providers report application/octet-stream — fall back to a plain
            // read, which is correct for any UTF-8 text file regardless of the reported MIME.
            else -> extractPlainText(context, uri)
        }.trim()

        if (text.isBlank()) throw EmptyExtraction()
        text
    }

    // ---- TXT / any UTF-8 text ------------------------------------------------------------------

    private fun extractPlainText(context: Context, uri: Uri): String =
        context.contentResolver.openInputStream(uri)?.use { it.bufferedReader(Charsets.UTF_8).readText() }
            ?: ""

    // ---- PDF -----------------------------------------------------------------------------------

    private fun extractPdf(context: Context, uri: Uri): String {
        if (!pdfBoxInited) {
            // Loads PdfBox's font/resource assets. Idempotent, cheap after the first call.
            PDFBoxResourceLoader.init(context.applicationContext)
            pdfBoxInited = true
        }
        return context.contentResolver.openInputStream(uri)?.use { input ->
            PDDocument.load(input).use { doc ->
                // Walks pages in order; PDFTextStripper preserves line breaks between lines.
                PDFTextStripper().apply { sortByPosition = true }.getText(doc)
            }
        } ?: ""
    }

    // ---- DOCX / PPTX (Office Open XML = a zip of XML) -------------------------------------------

    private fun isDocx(mime: String, name: String): Boolean =
        mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            name.endsWith(".docx")

    private fun isPptx(mime: String, name: String): Boolean =
        mime == "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
            name.endsWith(".pptx")

    /**
     * DOCX: text lives in word/document.xml. PPTX: one XML per slide under ppt/slides/slideN.xml.
     * Slides are ordered by their numeric suffix and separated by a blank line; paragraphs within
     * each are preserved (see officeXmlToText).
     */
    private fun extractOfficeXml(context: Context, uri: Uri, entryPrefix: String, isSlides: Boolean): String {
        val parts = sortedMapOf<Int, String>() // slide index -> text (docx uses a single bucket 0)
        context.contentResolver.openInputStream(uri)?.use { input ->
            ZipInputStream(input).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    val entryName = entry.name
                    val take = if (isSlides) {
                        entryName.startsWith(entryPrefix) && entryName.endsWith(".xml") &&
                            entryName.substringAfterLast('/').startsWith("slide")
                    } else {
                        entryName == "word/document.xml"
                    }
                    if (take) {
                        val xml = zis.readBytes().toString(Charsets.UTF_8)
                        val idx = if (isSlides) slideNumber(entryName) else 0
                        parts[idx] = officeXmlToText(xml, paragraphTag = if (isSlides) "a:p" else "w:p")
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }
        }
        return parts.values.filter { it.isNotBlank() }.joinToString(if (isSlides) "\n\n" else "\n")
    }

    private fun slideNumber(entryName: String): Int =
        Regex("slide(\\d+)\\.xml").find(entryName.substringAfterLast('/'))?.groupValues?.get(1)?.toIntOrNull() ?: 0

    private fun officeXmlToText(xml: String, paragraphTag: String): String {
        // 1. Turn the document's structural breaks into real whitespace (the only tags that carry
        //    line/paragraph meaning): paragraph end -> newline, tab -> tab, explicit break ->
        //    newline. 2. Strip every remaining tag — the visible text nodes (chiefly <w:t>/<a:t>
        //    run contents) stay in original order, and the newlines we inserted survive because
        //    they aren't tags. 3. Unescape XML entities.
        val withBreaks = xml
            .replace(Regex("</$paragraphTag>"), "\n")
            .replace(Regex("<$paragraphTag\\b[^>]*/>"), "\n")
            .replace(Regex("<w:tab\\b[^>]*/>"), "\t")
            .replace(Regex("<w:br\\b[^>]*/>"), "\n")
            .replace(Regex("<a:br\\b[^>]*/>"), "\n")
        val stripped = withBreaks.replace(Regex("<[^>]+>"), "")
        return unescapeXml(stripped)
            .lines().joinToString("\n") { it.trimEnd() }
            .replace(Regex("\n{3,}"), "\n\n") // collapse runs of blank lines the tags left behind
            .trim()
    }

    private fun unescapeXml(s: String): String = s
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")

    // ---- Image OCR (ML Kit, on-device) ---------------------------------------------------------

    private suspend fun extractImageOcr(context: Context, uri: Uri): String {
        val image = InputImage.fromFilePath(context, uri)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        // ML Kit preserves reading order and line structure in result.text.
        return recognizer.process(image).await().text
    }

    private fun String.matchesImage(): Boolean =
        endsWith(".jpg") || endsWith(".jpeg") || endsWith(".png") || endsWith(".webp") ||
            endsWith(".bmp") || endsWith(".heic") || endsWith(".heif")
}
