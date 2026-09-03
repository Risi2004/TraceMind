import { retrieveRelevantChunks } from '../services/retrieval.service.js';
import { generateGroundedAnswer, getOllamaLlmModel } from '../services/qwen.service.js';

/**
 * Perform raw chunk retrieval only (POST /api/rag/search)
 */
export const searchRag = async (req, res) => {
  try {
    const userId = req.user._id;
    const { query, documentId, topK, scoreThreshold } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A valid search query string is required in request body.',
      });
    }

    const result = await retrieveRelevantChunks({
      query: query.trim(),
      userId,
      documentId: documentId && documentId !== 'all' ? documentId : undefined,
      topK: topK ? parseInt(topK, 10) : undefined,
      scoreThreshold: scoreThreshold !== undefined ? parseFloat(scoreThreshold) : undefined,
    });

    return res.status(200).json({
      success: true,
      query: result.query,
      scope: result.scope,
      totalResults: result.totalResults,
      chunks: result.chunks,
    });
  } catch (error) {
    console.error('Error in searchRag controller:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error occurred while performing RAG search.',
    });
  }
};

/**
 * End-to-End Grounded RAG Query (POST /api/rag/query)
 * 1. Retrieves relevant chunks from Qdrant Cloud via Nomic embeddings
 * 2. Prompts Qwen on RunPod Ollama with strict anti-hallucination grounding
 * 3. Returns grounded answer with verified source citations & page numbers
 */
export const queryRag = async (req, res) => {
  try {
    const userId = req.user._id;
    const { query, documentId, chatHistory = [], topK, scoreThreshold } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A valid query prompt is required.',
      });
    }

    // 1. Retrieve top relevant chunks from Qdrant Cloud
    const retrievalResult = await retrieveRelevantChunks({
      query: query.trim(),
      userId,
      documentId: documentId && documentId !== 'all' ? documentId : undefined,
      topK: topK ? parseInt(topK, 10) : undefined,
      scoreThreshold: scoreThreshold !== undefined ? parseFloat(scoreThreshold) : undefined,
    });

    // 2. Generate grounded answer via Qwen on RunPod
    const answer = await generateGroundedAnswer({
      question: query.trim(),
      contextChunks: retrievalResult.chunks,
      chatHistory,
    });

    // 3. Format sources & citation metadata
    const sources = retrievalResult.chunks.map((chunk) => ({
      fileName: chunk.fileName,
      pageNumber: chunk.pageNumber,
      documentId: chunk.documentId,
      chunkNumber: chunk.chunkNumber,
      similarityScore: chunk.similarityScore,
      chunkExcerpt:
        chunk.chunkText.length > 220
          ? `${chunk.chunkText.slice(0, 220)}...`
          : chunk.chunkText,
      fullText: chunk.chunkText,
      pointId: chunk.pointId,
    }));

    return res.status(200).json({
      success: true,
      answer,
      query: query.trim(),
      scope: retrievalResult.scope,
      totalEvidenceChunks: retrievalResult.totalResults,
      sources,
      model: getOllamaLlmModel(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in queryRag controller:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process RAG query with Qwen.',
    });
  }
};

export default {
  searchRag,
  queryRag,
};
