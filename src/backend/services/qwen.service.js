import dotenv from 'dotenv';
import { getOllamaBaseUrl, isOllamaConfigured } from './ollama.service.js';

dotenv.config();

/**
 * Qwen LLM Client for RunPod Hosted Ollama Server
 * Enforces strict grounding, citation generation, and anti-hallucination guardrails.
 */

export const getOllamaLlmModel = () => {
  return (process.env.OLLAMA_LLM_MODEL || 'qwen2.5').trim();
};

/**
 * Build a structured, grounded system & user prompt with document context blocks
 */
export const buildGroundedPrompt = ({ question, contextChunks = [] }) => {
  const systemPrompt = `You are TraceMind AI, an elite document intelligence and verification assistant.

CRITICAL GROUNDING RULES:
1. Answer the user's question SOLELY and EXCLUSIVELY using the verified DOCUMENT EVIDENCE provided below.
2. Do NOT use outside knowledge, unverified assumptions, or speculation.
3. If the provided document evidence does NOT contain sufficient information to answer the question accurately, you MUST explicitly state:
"Based on the provided documents, there is not enough information to answer this question."
Do NOT fabricate, guess, or invent any details.
4. When stating facts, clearly cite your sources using tags like [Source 1, Page X] or by referencing the file name and page number.
5. Provide a well-structured, clear, professional, and direct answer with bullet points or tables where appropriate.`;

  if (!contextChunks || contextChunks.length === 0) {
    const userPrompt = `USER QUESTION: ${question}

DOCUMENT EVIDENCE:
No relevant document passages were found in the selected scope.

Please advise that no document evidence is available to answer this question.`;
    return { systemPrompt, userPrompt };
  }

  const evidenceBlocks = contextChunks
    .map((chunk, index) => {
      const sourceNum = index + 1;
      const fileName = chunk.fileName || 'Document';
      const pageNum = chunk.pageNumber || 1;
      const score = chunk.similarityScore ? ` (Relevance: ${(chunk.similarityScore * 100).toFixed(1)}%)` : '';

      return `[Source ${sourceNum}]: File: "${fileName}" | Page: ${pageNum}${score}
"""
${chunk.chunkText}
"""`;
    })
    .join('\n\n');

  const userPrompt = `DOCUMENT EVIDENCE:
${evidenceBlocks}

USER QUESTION:
${question}

Provide a grounded, factual answer based strictly on the document evidence above:`;

  return { systemPrompt, userPrompt };
};

/**
 * Call RunPod Ollama Qwen model to generate a strictly grounded answer
 * @param {Object} params
 * @param {string} params.question - The user's prompt or question
 * @param {Array<Object>} params.contextChunks - Retrieved chunks from Qdrant Cloud
 * @param {Array<Object>} [params.chatHistory] - Optional prior conversation messages
 * @param {number} [params.temperature=0.1] - Sampling temperature (low for factual grounding)
 * @returns {Promise<string>} Generated grounded response text
 */
export const generateGroundedAnswer = async ({
  question,
  contextChunks = [],
  chatHistory = [],
  temperature = 0.1,
}) => {
  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaLlmModel();

  if (!isOllamaConfigured()) {
    throw new Error(
      'RunPod Ollama is not configured. Please set OLLAMA_BASE_URL in .env.'
    );
  }

  const { systemPrompt, userPrompt } = buildGroundedPrompt({
    question,
    contextChunks,
  });

  // Prepare messages payload for Ollama /api/chat
  const messages = [
    { role: 'system', content: systemPrompt },
    // Filter and sanitize recent chat history (keep last 6 turns for context continuity)
    ...chatHistory.slice(-6).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content || '',
    })),
    { role: 'user', content: userPrompt },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout for LLM generation

  console.log(`\n🧠 [Qwen Service] Generating grounded answer with model: "${model}" on RunPod...`);
  console.log(`📄 [Qwen Service] Evidence passages provided: ${contextChunks.length}`);

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature,
          num_ctx: 8192,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 404 || errText.includes('not found') || errText.includes('try pulling')) {
        throw new Error(
          `Ollama model "${model}" was not found on your RunPod instance. Please connect to your RunPod terminal and run: "ollama pull ${model}".`
        );
      }
      throw new Error(
        `RunPod Ollama returned HTTP ${response.status}: ${errText || response.statusText}`
      );
    }

    const data = await response.json();
    const replyText = data.message?.content || data.response || '';

    if (!replyText.trim()) {
      throw new Error('RunPod Ollama returned an empty response.');
    }

    console.log(`✅ [Qwen Service] Answer generated successfully (${replyText.length} characters).\n`);
    return replyText.trim();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(
        `RunPod Ollama generation timed out after 90s. Ensure your RunPod GPU is active and has sufficient memory.`
      );
    }
    console.error(`❌ [Qwen Service] Error:`, error.message);
    throw error;
  }
};

export default {
  generateGroundedAnswer,
  buildGroundedPrompt,
  getOllamaLlmModel,
};
