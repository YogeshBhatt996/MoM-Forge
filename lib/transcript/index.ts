// ─────────────────────────────────────────────────────────────────────────────
// Transcript Extraction Service
// Supports: .txt, .pdf, .docx
// Add new extractors here without touching calling code.
// ─────────────────────────────────────────────────────────────────────────────

export interface TranscriptExtractor {
  canHandle(mimeType: string): boolean;
  extract(buffer: ArrayBuffer): Promise<string>;
}

// ─── Plain text ───────────────────────────────────────────────────────────────
const textExtractor: TranscriptExtractor = {
  canHandle: (mime) => mime === "text/plain" || mime.startsWith("text/"),
  async extract(buffer) {
    return new TextDecoder().decode(buffer);
  },
};

// ─── PDF ──────────────────────────────────────────────────────────────────────
const pdfExtractor: TranscriptExtractor = {
  canHandle: (mime) => mime === "application/pdf",
  async extract(buffer) {
    // Dynamic import to avoid bundling issues in edge runtime
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(Buffer.from(buffer));
    return data.text;
  },
};

// ─── DOCX ─────────────────────────────────────────────────────────────────────
const docxExtractor: TranscriptExtractor = {
  canHandle: (mime) =>
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword",
  async extract(buffer) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return result.value;
  },
};

const extractors: TranscriptExtractor[] = [textExtractor, pdfExtractor, docxExtractor];

export async function extractTranscriptText(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const extractor = extractors.find((e) => e.canHandle(mimeType));
  if (!extractor) {
    throw new Error(`Unsupported transcript file type: ${mimeType}`);
  }
  const text = await extractor.extract(buffer);
  if (!text || text.trim().length === 0) {
    throw new Error("Transcript appears to be empty or unreadable.");
  }
  return text.trim();
}
