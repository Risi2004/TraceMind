import { createRequire } from 'module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');


/**
 * Text Extractor Service for TraceMind RAG Pipeline
 * Supports PDF, DOCX, TXT, and Markdown files.
 */

/**
 * Extract text and page structure from a PDF buffer
 */
export const extractTextFromPdf = async (buffer) => {
  const pages = [];
  let pageIndex = 1;

  try {
    // Custom page renderer to track individual page contents
    const customPageRender = (pageData) => {
      return pageData.getTextContent().then((textContent) => {
        let lastY;
        let pageText = '';
        for (const item of textContent.items) {
          if (lastY === undefined || lastY === item.transform[5]) {
            pageText += (pageText && !pageText.endsWith(' ') ? ' ' : '') + item.str;
          } else {
            pageText += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        pages.push({
          pageNumber: pageIndex++,
          text: pageText.trim(),
        });

        return pageText;
      });
    };

    const parsed = await pdfParse(buffer, {
      pagerender: customPageRender,
    });

    // If custom pagerender didn't populate individual pages, fallback to form-feed split
    if (pages.length === 0 && parsed.text) {
      const rawPages = parsed.text.split(/\f/g);
      rawPages.forEach((text, i) => {
        if (text.trim()) {
          pages.push({
            pageNumber: i + 1,
            text: text.trim(),
          });
        }
      });
    }

    return {
      fullText: parsed.text || '',
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: parsed.text || '' }],
      totalPages: parsed.numpages || (pages.length > 0 ? pages.length : 1),
    };
  } catch (err) {
    console.warn(`[PDF Parser] Custom pagerender issue, falling back to basic parsing: ${err.message}`);
    const fallbackParsed = await pdfParse(buffer);
    return {
      fullText: fallbackParsed.text || '',
      pages: [{ pageNumber: 1, text: fallbackParsed.text || '' }],
      totalPages: fallbackParsed.numpages || 1,
    };
  }
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
