import { createRequire } from 'module';
import mammoth from 'mammoth';

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
 * Text Extractor Service for TraceMind RAG Pipeline
 * Supports PDF, DOCX, TXT, and Markdown files.
 */

/**
 * Extract raw text strings from corrupted or bad-XRef PDF buffers
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

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) {
        pages.push({
          pageNumber: p,
          text: pageText,
        });
        fullText += (fullText ? '\n\n' : '') + pageText;
      }
    }

    if (fullText.trim()) {
      return {
        fullText: fullText.trim(),
        pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText.trim() }],
        totalPages: pdfDoc.numPages || pages.length || 1,
      };
    }
  } catch (err) {
    console.warn(`[PDF Parser] Modern pdfjs-dist parsing error: ${err.message}. Trying legacy parser...`);
  }

  // Tier 2 Fallback: Standard pdfParse without custom pagerender
  try {

    const fallbackParsed = await pdfParse(buffer);
    const fullText = (fallbackParsed.text || '').trim();
    if (fullText) {
      const rawPages = fullText.split(/\f/g);
      const fallbackPages = [];
      rawPages.forEach((text, i) => {
        if (text.trim()) {
          fallbackPages.push({ pageNumber: i + 1, text: text.trim() });
        }
      });

      return {
        fullText,
        pages: fallbackPages.length > 0 ? fallbackPages : [{ pageNumber: 1, text: fullText }],
        totalPages: fallbackParsed.numpages || 1,
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
export const extractDocumentText = async ({ buffer, filename, fileType }) => {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const type = (fileType || '').toUpperCase();

  if (type === 'PDF' || ext === 'pdf') {
    return extractTextFromPdf(buffer);
  }

  if (type === 'DOCX' || ext === 'docx') {
    return extractTextFromDocx(buffer);
  }

  if (type === 'MD' || ext === 'md' || ext === 'markdown') {
    return extractTextFromMarkdown(buffer);
  }

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
  extractTextFromPdf,
  extractTextFromDocx,
  extractTextFromTxt,
  extractTextFromMarkdown,
};
