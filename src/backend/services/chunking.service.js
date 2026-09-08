/**
 * Semantic Chunking Service for TraceMind RAG Pipeline
 * - ~1000 tokens target per chunk (~3500-4000 chars)
 * - 10-15% overlap (~100-150 tokens / ~400-500 chars)
 * - Preserves headings (#), paragraphs (\n\n), and sentence boundaries
 * - Includes user ID, document ID, file name, archive name, relative path, page number, and chunk index metadata
 */

const DEFAULT_TARGET_TOKENS = 1000;
const DEFAULT_OVERLAP_PERCENT = 0.12; // 12% (within 10-15%)

// Approximate tokens by word count / 4 characters per token
export const estimateTokenCount = (text) => {
  if (!text) return 0;
  const wordCount = text.trim().split(/\s+/).length;
  const charBased = Math.ceil(text.length / 4);
  return Math.max(wordCount, charBased);
};

/**
 * Split text into semantic atomic blocks (headings, paragraphs, sentences)
 */
const splitIntoSemanticUnits = (text) => {
  if (!text || !text.trim()) return [];

  // Split by markdown headings or double newlines (paragraphs)
  const paragraphBlocks = text.split(/(?:\r?\n){2,}|\n(?=#{1,6}\s)/g);
  const semanticUnits = [];

  for (const block of paragraphBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // If block is very long (e.g., > 1200 tokens), break it down by sentences
    if (estimateTokenCount(trimmed) > 1200) {
      const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [trimmed];
      for (const sentence of sentences) {
        if (sentence.trim()) {
          semanticUnits.push(sentence.trim());
        }
      }
    } else {
      semanticUnits.push(trimmed);
    }
  }

  return semanticUnits;
};

/**
 * Perform chunking on a text string with target token size and overlap
 */
export const chunkText = (
  text,
  {
    targetTokens = DEFAULT_TARGET_TOKENS,
    overlapPercent = DEFAULT_OVERLAP_PERCENT,
    pageNumber = 1,
  } = {}
) => {
  const units = splitIntoSemanticUnits(text);
  if (units.length === 0) return [];

  const chunks = [];
  let currentUnits = [];
  let currentTokens = 0;

  const overlapTokenCount = Math.floor(targetTokens * overlapPercent);

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const unitTokens = estimateTokenCount(unit);

    if (currentTokens + unitTokens > targetTokens && currentUnits.length > 0) {
      // Finalize current chunk
      const chunkContent = currentUnits.join('\n\n').trim();
      chunks.push({
        text: chunkContent,
        tokenCount: currentTokens,
        pageNumber,
      });

      // Calculate overlap: keep recent units that fit within overlapTokenCount
      let overlapUnits = [];
      let overlapCount = 0;

      for (let j = currentUnits.length - 1; j >= 0; j--) {
        const uTokens = estimateTokenCount(currentUnits[j]);
        if (overlapCount + uTokens <= overlapTokenCount) {
          overlapUnits.unshift(currentUnits[j]);
          overlapCount += uTokens;
        } else {
          break;
        }
      }

      currentUnits = [...overlapUnits, unit];
      currentTokens = overlapCount + unitTokens;
    } else {
      currentUnits.push(unit);
      currentTokens += unitTokens;
    }
  }

  // Push remaining units
  if (currentUnits.length > 0) {
    const chunkContent = currentUnits.join('\n\n').trim();
    if (chunkContent) {
      chunks.push({
        text: chunkContent,
        tokenCount: currentTokens,
        pageNumber,
      });
    }
  }

  return chunks;
};

/**
 * Create chunks from full document text or page-by-page array with full metadata grounding
 */
export const createDocumentChunks = ({
  pages = [],
  fullText = '',
  documentId,
  userId,
  fileName,
  originalName = null,
  archiveName = null,
  relativePath = null,
  targetTokens = DEFAULT_TARGET_TOKENS,
  overlapPercent = DEFAULT_OVERLAP_PERCENT,
}) => {
  const allRawChunks = [];

  if (pages && pages.length > 0) {
    // Process page by page to maintain accurate page number grounding
    for (const page of pages) {
      if (!page.text || !page.text.trim()) continue;

      const pageChunks = chunkText(page.text, {
        targetTokens,
        overlapPercent,
        pageNumber: page.pageNumber || 1,
      });

      allRawChunks.push(...pageChunks);
    }
  } else if (fullText && fullText.trim()) {
    const rawChunks = chunkText(fullText, {
      targetTokens,
      overlapPercent,
      pageNumber: 1,
    });
    allRawChunks.push(...rawChunks);
  }

  const totalChunks = allRawChunks.length;

  // Enrich with required metadata including ZIP archive origins
  return allRawChunks.map((chunk, index) => {
    const isImageChunk = Boolean(chunk.isImage || (pages[0] && pages[0].isImage));
    const sourceType = isImageChunk ? 'image' : 'document';
    const contentType = isImageChunk ? 'image' : 'document';
    const visionModel = isImageChunk ? (process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:8b').trim() : null;

    return {
      documentId,
      userId,
      fileName,
      originalName: originalName || fileName,
      archiveName: archiveName || null,
      relativePath: relativePath || null,
      chunkIndex: index,
      totalChunks,
      pageNumber: chunk.pageNumber || 1,
      imageIndex: isImageChunk ? 0 : undefined,
      text: chunk.text,
      charCount: chunk.text.length,
      tokenCount: chunk.tokenCount || estimateTokenCount(chunk.text),
      isImage: isImageChunk,
      sourceType,
      contentType,
      visionModel,
      metadata: {
        chunkNumber: index + 1,
        totalChunks,
        pageNumber: chunk.pageNumber || 1,
        imageIndex: isImageChunk ? 0 : undefined,
        fileName,
        originalName: originalName || fileName,
        archiveName: archiveName || null,
        relativePath: relativePath || null,
        isImage: isImageChunk,
        sourceType,
        contentType,
        visionModel,
      },
    };
  });
};

export default {
  chunkText,
  createDocumentChunks,
  estimateTokenCount,
};
