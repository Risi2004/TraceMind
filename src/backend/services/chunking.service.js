/**
 * Semantic Chunking Service for TraceMind RAG Pipeline
 * - ~1000 tokens target per chunk (~3500-4000 chars)
 * - 10-15% overlap (~100-150 tokens / ~400-500 chars)
 * - Preserves headings (#), paragraphs (\n\n), and sentence boundaries
 * - Includes user ID, document ID, file name, page number, and chunk index metadata
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

    // If single unit alone exceeds targetTokens, push it directly
    if (unitTokens >= targetTokens) {
      if (currentUnits.length > 0) {
        chunks.push({
          text: currentUnits.join('\n\n'),
          tokenCount: currentTokens,
          pageNumber,
        });
        currentUnits = [];
        currentTokens = 0;
      }

      chunks.push({
        text: unit,
        tokenCount: unitTokens,
        pageNumber,
      });
      continue;
    }

    // If adding unit exceeds target chunk capacity
    if (currentTokens + unitTokens > targetTokens && currentUnits.length > 0) {
      const chunkTextContent = currentUnits.join('\n\n');
      chunks.push({
        text: chunkTextContent,
        tokenCount: currentTokens,
        pageNumber,
      });

      // Calculate overlap units from the end of current chunk
      const overlapUnits = [];
      let overlapAccumulatedTokens = 0;

      for (let j = currentUnits.length - 1; j >= 0; j--) {
        const prevUnit = currentUnits[j];
        const prevTokens = estimateTokenCount(prevUnit);
        if (overlapAccumulatedTokens + prevTokens <= overlapTokenCount) {
          overlapUnits.unshift(prevUnit);
          overlapAccumulatedTokens += prevTokens;
        } else {
          break;
        }
      }

      currentUnits = [...overlapUnits, unit];
      currentTokens = overlapAccumulatedTokens + unitTokens;
    } else {
      currentUnits.push(unit);
      currentTokens += unitTokens;
    }
  }

  // Push remainder chunk
  if (currentUnits.length > 0) {
    chunks.push({
      text: currentUnits.join('\n\n'),
      tokenCount: currentTokens,
      pageNumber,
    });
  }

  return chunks;
};

/**
 * Split document pages into structured RAG chunks with full metadata
 */
export const createDocumentChunks = ({
  pages = [],
  fullText = '',
  documentId,
  userId,
  fileName,
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

  // Enrich with required metadata
  return allRawChunks.map((chunk, index) => ({
    documentId,
    userId,
    fileName,
    chunkIndex: index,
    totalChunks,
    pageNumber: chunk.pageNumber || 1,
    text: chunk.text,
    charCount: chunk.text.length,
    tokenCount: chunk.tokenCount || estimateTokenCount(chunk.text),
    metadata: {
      chunkNumber: index + 1,
      totalChunks,
      pageNumber: chunk.pageNumber || 1,
      fileName,
    },
  }));
};

export default {
  chunkText,
  createDocumentChunks,
  estimateTokenCount,
};
