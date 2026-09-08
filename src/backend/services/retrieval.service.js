import dotenv from 'dotenv';
import { generateEmbedding } from './ollama.service.js';
import { searchSimilarChunks } from './qdrant.service.js';
import { traceRetrievalSpan } from './langsmith.service.js';

dotenv.config();

/**
 * RAG Retrieval & Semantic Search Service
 * Generates question vector via RunPod Ollama and performs scoped similarity search in Qdrant Cloud.
 */

export const getRagTopK = () => {
  return parseInt(process.env.RAG_TOP_K || '8', 10);
};

/**
 * Retrieve the most relevant chunks for a user's question
 * @param {Object} options
 * @param {string} options.query - The user's prompt or question
 * @param {string} options.userId - Authenticated user ID (strict tenant isolation)
 * @param {string} [options.documentId] - Optional document ID scope filter
 * @param {number} [options.topK] - Number of top chunks to retrieve (default: 8)
 * @param {number} [options.scoreThreshold] - Optional minimum similarity score
 * @returns {Promise<Object>} Formatted search results with matched chunks and metadata
 */
export const retrieveRelevantChunks = async ({
  query,
  userId,
  documentId,
  topK,
  scoreThreshold,
}) => {
  if (!query || !query.trim()) {
    throw new Error('Search query text is required.');
  }

  if (!userId) {
    throw new Error('User ID is required for scoped search.');
  }

  const limit = topK || getRagTopK();
  const scopeDisplay = Array.isArray(documentId)
    ? (documentId.length === 0 ? 'all_documents' : documentId.join(', '))
    : (documentId || 'all_documents');

  console.log(`\n🔍 [RAG Retrieval] Query: "${query}"`);
  console.log(`👤 [RAG Retrieval] User ID: ${userId} | Scope: ${scopeDisplay} | Top K: ${limit}`);

  try {
    // 1. Generate dense vector embedding for user query via RunPod Ollama (Nomic Embed Text)
    console.log(`⚡ [RAG Retrieval] Generating query embedding on RunPod GPU...`);
    const embedStart = Date.now();
    const queryVector = await traceRetrievalSpan(
      'Query Embedding',
      async () => await generateEmbedding(query.trim()),
      { searchQuery: query.trim(), model: 'nomic-embed-text' }
    );
    const embedDurationMs = Date.now() - embedStart;

    if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
      throw new Error('Failed to generate embedding for search query.');
    }

    // 2. Perform scoped semantic search in Qdrant Cloud (fetch broader candidate pool)
    const searchLimit = Math.max(limit * 6, 64);
    console.log(`🔷 [RAG Retrieval] Searching Qdrant Cloud (Candidate Pool: ${searchLimit})...`);
    const qdrantStart = Date.now();
    const points = await traceRetrievalSpan(
      'Qdrant Vector Search',
      async () => await searchSimilarChunks({
        userId,
        documentId: documentId && documentId !== 'all' ? documentId : undefined,
        queryVector,
        limit: searchLimit,
        scoreThreshold,
      }),
      { candidatePoolSize: searchLimit, documentScope: scopeDisplay, scoreThreshold: scoreThreshold || 0 }
    );
    const qdrantDurationMs = Date.now() - qdrantStart;


    const topChunks = await traceRetrievalSpan(
      'Candidate Ranking',
      async () => {
        // Extract meaningful entity & domain tokens (filtering common English stopwords)
        const STOPWORDS = new Set([
          'state', 'that', 'this', 'what', 'when', 'where', 'which', 'with',
          'from', 'into', 'true', 'marks', 'precise', 'year', 'about', 'some',
          'does', 'have', 'been', 'their', 'there', 'they', 'were', 'also'
        ]);
        const queryTokens = (query.match(/\\b[A-Za-z0-9_-]{4,}\\b/g) || [])
          .map((t) => t.toLowerCase())
          .filter((t) => !STOPWORDS.has(t));

        // 3. Format and score chunks with exact-keyword boosting
        const formattedChunks = (points || []).map((point) => {
          const payload = point.payload || {};
          const chunkText = payload.text || payload.chunkText || payload.formattedText || '';
          const textLower = chunkText.toLowerCase();

          let exactMatchesCount = 0;
          for (const token of queryTokens) {
            if (textLower.includes(token)) {
              exactMatchesCount++;
            }
          }

          const baseScore =
            typeof point.score === 'number'
              ? parseFloat(point.score.toFixed(4))
              : 0.75;
          const boostedScore = exactMatchesCount > 0 ? Math.min(1.0, baseScore + 0.25 * exactMatchesCount) : baseScore;

          return {
            chunkText,
            fileName: payload.fileName || '',
            archiveName: payload.archiveName || null,
            relativePath: payload.relativePath || null,
            sourceType: payload.sourceType || (payload.isImage ? 'image' : 'document'),
            isImage: Boolean(payload.isImage),
            documentId: payload.documentId || '',
            pageNumber: payload.pageNumber || 1,
            chunkNumber:
              payload.chunkNumber ||
              (payload.chunkIndex !== undefined ? payload.chunkIndex + 1 : 1),
            similarityScore: parseFloat(boostedScore.toFixed(4)),
            hasExactMatch: exactMatchesCount > 0,
            tokenCount: payload.tokenCount || 0,
            charCount: payload.charCount || chunkText.length,
            pointId: point.id,
          };
        });

        formattedChunks.sort((a, b) => {
          if (a.hasExactMatch && !b.hasExactMatch) return -1;
          if (!a.hasExactMatch && b.hasExactMatch) return 1;
          return (b.similarityScore || 0) - (a.similarityScore || 0);
        });

        return formattedChunks.slice(0, limit);
      },
      {
        query,
        candidateCount: points?.length || 0,
        topKLimit: limit,
      }
    );

    console.log(
      `✅ [RAG Retrieval] Found ${topChunks.length} relevant chunk(s) (${
        topChunks.filter((c) => c.hasExactMatch).length
      } with exact entity matches).\n`
    );

    return {
      success: true,
      query: query.trim(),
      scope: documentId && documentId !== 'all' ? documentId : 'all_documents',
      totalResults: topChunks.length,
      chunks: topChunks,
      embedDurationMs,
      qdrantDurationMs,
    };

  } catch (error) {
    console.error(`❌ [RAG Retrieval] Search failed:`, error.message);
    throw new Error(`RAG retrieval failed: ${error.message}`);
  }
};

export default {
  retrieveRelevantChunks,
  getRagTopK,
};
