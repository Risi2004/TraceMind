import { retrieveRelevantChunks } from '../services/retrieval.service.js';
import { executeAdkInvestigation } from '../agents/adkOrchestrator.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';

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
 * Agentic Iterative RAG Query via Google ADK (POST /api/rag/query)
 * Coordinates Planner -> Retrieval -> Evidence -> Sufficiency -> Follow-up loop -> Answer Agent
 */
export const queryRag = async (req, res) => {
  try {
    const userId = req.user._id;
    const { query, documentId, chatHistory = [], maxRounds } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A valid query prompt is required.',
      });
    }

    const result = await executeAdkInvestigation({
      query: query.trim(),
      userId,
      documentId: documentId && documentId !== 'all' ? documentId : undefined,
      chatHistory,
      maxRounds: maxRounds ? parseInt(maxRounds, 10) : 4,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in queryRag controller (Google ADK):', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process agentic RAG query with Google ADK & Qwen.',
    });
  }
};

export default {
  searchRag,
  queryRag,
};

