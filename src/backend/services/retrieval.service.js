import dotenv from 'dotenv';
import { generateEmbedding } from './ollama.service.js';
import { searchSimilarChunks } from './qdrant.service.js';

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

  console.log(`\n🔍 [RAG Retrieval] Query: "${query}"`);
  console.log(`👤 [RAG Retrieval] User ID: ${userId} | Scope: ${documentId || 'all_documents'} | Top K: ${limit}`);

  try {
    // 1. Generate dense vector embedding for user query via RunPod Ollama (Nomic Embed Text)
    console.log(`⚡ [RAG Retrieval] Generating query embedding on RunPod GPU...`);
    const queryVector = await generateEmbedding(query.trim());

    if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
      throw new Error('Failed to generate embedding for search query.');
    }

    // 2. Perform scoped semantic search in Qdrant Cloud
    console.log(`🔷 [RAG Retrieval] Searching Qdrant Cloud (Top ${limit} chunks)...`);
    const points = await searchSimilarChunks({
      userId,
      documentId: documentId && documentId !== 'all' ? documentId : undefined,
      queryVector,
      limit,
      scoreThreshold,
    });

    // 3. Format matched chunks with all required metadata fields
    const formattedChunks = (points || []).map((point) => {
      const payload = point.payload || {};
      return {
        chunkText: payload.text || '',
        fileName: payload.fileName || '',
        documentId: payload.documentId || '',
        pageNumber: payload.pageNumber || 1,
        chunkNumber:
          payload.chunkNumber ||
          (payload.chunkIndex !== undefined ? payload.chunkIndex + 1 : 1),
        similarityScore:
          typeof point.score === 'number'
            ? parseFloat(point.score.toFixed(4))
            : null,
        tokenCount: payload.tokenCount || 0,
        charCount: payload.charCount || (payload.text ? payload.text.length : 0),
        pointId: point.id,
      };
    });

    console.log(`✅ [RAG Retrieval] Found ${formattedChunks.length} relevant chunk(s).\n`);

    return {
      success: true,
      query: query.trim(),
      scope: documentId && documentId !== 'all' ? documentId : 'all_documents',
      totalResults: formattedChunks.length,
      chunks: formattedChunks,
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
