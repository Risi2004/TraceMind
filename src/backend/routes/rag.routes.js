import express from 'express';
import { searchRag, queryRag } from '../controllers/rag.controller.js';
import { protect } from '../middleware/auth.middleware.js';


const router = express.Router();

/**
 * @route   POST /api/rag/search
 * @desc    Retrieve top relevant chunks from Qdrant Cloud for user query
 * @access  Private (Authenticated users only)
 */
router.post('/search', protect, searchRag);

/**
 * @route   POST /api/rag/query
 * @desc    Full Grounded RAG Generation (Qdrant Retrieval + RunPod Qwen Answer)
 * @access  Private (Authenticated users only)
 */
router.post('/query', protect, queryRag);

export default router;

