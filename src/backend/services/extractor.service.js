import { createRequire } from 'module';
import mammoth from 'mammoth';
import { runVisionAgent } from '../agents/vision.agent.js';

// Polyfill standard DOM objects for Node.js environment to cleanly silence PDF.js visual canvas warnings
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {};
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {};
}

let pdfjsLibInstance = null;
const getPdfJs = async () => {
  if (!pdfjsLibInstance) {
    pdfjsLibInstance = await import('pdfjs-dist/legacy/build/pdf.js');
  }
  return pdfjsLibInstance;
};

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Text & Vision Extractor Service for TraceMind RAG Pipeline
 * Supports PDF, DOCX, TXT, Markdown, and Images (PNG, JPG, JPEG, WEBP).
 */

/**
 * Extract raw text from corrupted or bad-XRef PDF buffers
 */
const extractRawTextFromPdfBinary = (buffer) => {
  try {
    const raw = buffer.toString('binary');
    const textPieces = [];

    // Match (Text) Tj and [(Text)] TJ operators
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match;
    while ((match = tjRegex.exec(raw)) !== null) {
      const clean = match[1]
        .replace(/\\([()\\])/g, '$1')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .trim();
      if (clean) textPieces.push(clean);
    }

    const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(raw)) !== null) {
      const innerTj = match[1];
      const innerMatches = innerTj.match(/\(([^)]+)\)/g);
      if (innerMatches) {
        const piece = innerMatches
          .map((m) => m.slice(1, -1).replace(/\\([()\\])/g, '$1'))
          .join('');
        if (piece.trim()) textPieces.push(piece.trim());
      }
    }

    if (textPieces.length > 0) {
      return textPieces.join(' ');
    }

    // Fallback: extract long printable string sequences (length >= 4)
    const printableRegex = /[\x20-\x7E\s]{4,}/g;
    const matches = raw.match(printableRegex) || [];
    const filtered = matches.filter(
      (m) =>
        !m.startsWith('/Filter') &&
        !m.startsWith('/Length') &&
        !m.includes('endstream') &&
        !m.includes('endobj')
    );
    return filtered.join('\n').trim();
  } catch {
    return buffer.toString('utf-8').trim();
  }
};

/**
 * Extract text and page structure from a PDF buffer using modern pdfjs-dist engine
 */
export const extractTextFromPdf = async (buffer) => {
  const pages = [];

  // Tier 1: Modern pdfjs-dist engine (handles ReportLab, XRef streams, complex fonts & damaged XRefs)
  try {
    const pdfjsLib = await getPdfJs();
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
      verbosity: 0,
    });

    const pdfDoc = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) {
        pages.push({
          pageNumber: pageNum,
          text: pageText,
        });
        fullText += (fullText ? '\n\n' : '') + `--- Page ${pageNum} ---\n` + pageText;
      }
    }

    if (pages.length > 0) {
      return {
        fullText,
        pages,
        totalPages: pdfDoc.numPages,
      };
    }
  } catch (err) {
    console.warn(`[PDF Parser] Tier 1 (pdfjs-dist) parse error (${err.message}). Trying Tier 2 (pdf-parse)...`);
  }

  // Tier 2: Standard pdf-parse fallback
  try {
    const data = await pdfParse(buffer);
    const fullText = (data.text || '').trim();

    if (fullText) {
      const pageChunks = fullText.split(/\f|\n(?=Page\s+\d+)/i);
      const formattedPages = pageChunks
        .map((t, idx) => ({
          pageNumber: idx + 1,
          text: t.trim(),
        }))
        .filter((p) => p.text.length > 0);

      return {
        fullText,
        pages: formattedPages.length > 0 ? formattedPages : [{ pageNumber: 1, text: fullText }],
        totalPages: data.numpages || formattedPages.length || 1,
      };
    }
  } catch (err) {
    console.warn(`[PDF Parser] Standard parser failed (${err.message}). Using raw stream recovery...`);
  }

  // Tier 3 Fallback: Binary stream text recovery for bad XRef / damaged PDFs
  const recoveredText = extractRawTextFromPdfBinary(buffer);
  console.log(`[PDF Parser] Raw stream recovery extracted ${recoveredText.length} characters.`);

  return {
    fullText: recoveredText,
    pages: [{ pageNumber: 1, text: recoveredText }],
    totalPages: 1,
  };
};

/**
 * Extract structured forensic visual evidence from an image using dedicated Google ADK Vision Agent
 */
export const extractFromImage = async ({ buffer, filename, mimeType, documentId }) => {
  const visionResult = await runVisionAgent({
    imageBuffer: buffer,
    fileName: filename || 'image.png',
    documentId: documentId || '',
    pageNumber: 1,
    imageIndex: 0,
  });

  return {
    fullText: visionResult.formattedText,
    pages: [
      {
        pageNumber: 1,
        text: visionResult.formattedText,
        isImage: true,
      },
    ],
    totalPages: 1,
    isImage: true,
    contentType: 'image',
    structuredEvidence: visionResult.structuredEvidence,
    events: visionResult.events,
    rawAnalysis: visionResult.rawResponse,
  };
};

/**
 * Extract raw text from a DOCX Word document buffer
 */
export const extractTextFromDocx = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  const fullText = (result.value || '').trim();

  // DOCX does not have fixed physical pages in raw format, treated as unified document
  return {
    fullText,
    pages: [{ pageNumber: 1, text: fullText }],
    totalPages: 1,
  };
};

/**
 * Extract text from plain text files (.txt)
 */
export const extractTextFromTxt = async (buffer) => {
  const fullText = buffer.toString('utf-8').trim();
  return {
    fullText,
    pages: [{ pageNumber: 1, text: fullText }],
    totalPages: 1,
  };
};

/**
 * Extract text from Markdown files (.md, .markdown)
 */
export const extractTextFromMarkdown = async (buffer) => {
  const fullText = buffer.toString('utf-8').trim();
  return {
    fullText,
    pages: [{ pageNumber: 1, text: fullText }],
    totalPages: 1,
  };
};

/**
 * Unified Extractor dispatcher by file type / extension
 */
export const extractDocumentText = async ({ buffer, filename, fileType, mimeType, documentId }) => {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const type = (fileType || '').toUpperCase();

  // CASE 1: Image files (PNG, JPG, JPEG, WEBP)
  if (
    type === 'IMAGE' ||
    ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ||
    (mimeType && mimeType.startsWith('image/'))
  ) {
    return extractFromImage({ buffer, filename, mimeType, documentId });
  }

  // CASE 2: PDF Documents
  if (type === 'PDF' || ext === 'pdf') {
    return extractTextFromPdf(buffer);
  }

  // CASE 3: Word Documents
  if (type === 'DOCX' || ext === 'docx') {
    return extractTextFromDocx(buffer);
  }

  // CASE 4: Markdown Documents
  if (type === 'MD' || ext === 'md' || ext === 'markdown') {
    return extractTextFromMarkdown(buffer);
  }

  // CASE 5: Text Documents
  if (type === 'TXT' || ext === 'txt') {
    return extractTextFromTxt(buffer);
  }

  // Generic fallback
  const fullText = buffer.toString('utf-8').trim();
  return {
    fullText,
    pages: [{ pageNumber: 1, text: fullText }],
    totalPages: 1,
  };
};

export default {
  extractDocumentText,
  extractFromImage,
  extractTextFromPdf,
  extractTextFromDocx,
  extractTextFromTxt,
  extractTextFromMarkdown,
};
