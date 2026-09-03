import { retrieveRelevantChunks } from '../services/retrieval.service.js';

/**
 * 2. Retrieval Agent (Google ADK Architecture)
 * Reuses TraceMind's Nomic Embeddings + Qdrant Cloud Vector Database.
 * Enforces strict user tenant isolation, document scoping, and deduplication across iterative search rounds.
 */

export const runRetrievalAgent = async ({
  searchQuery,
  userId,
  documentId,
  seenChunkIds = new Set(),
  topK = 6,
}) => {
  console.log(`🔎 [Retrieval Agent] Executing scoped vector search for: "${searchQuery}"`);

  const result = await retrieveRelevantChunks({
    query: searchQuery,
    userId,
    documentId,
    topK,
  });

  const rawChunks = result.chunks || [];
  const newChunks = [];

  for (const chunk of rawChunks) {
    const uniqueKey = chunk.pointId || `${chunk.documentId}_${chunk.pageNumber}_${chunk.chunkNumber}`;
    if (!seenChunkIds.has(uniqueKey)) {
      seenChunkIds.add(uniqueKey);
      newChunks.push(chunk);
    }
  }

  console.log(`✅ [Retrieval Agent] Retrieved ${rawChunks.length} chunks (${newChunks.length} new unique chunks).`);

  return {
    query: searchQuery,
    totalFound: rawChunks.length,
    newChunks,
    seenChunkIds,
  };
};

export default { runRetrievalAgent };
