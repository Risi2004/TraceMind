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
 * Build a structured, grounded system & user prompt with document context blocks and forensic reasoning rules
 */
export const buildGroundedPrompt = ({ question, contextChunks = [], conflictReport = null }) => {
  const hasConflict = Boolean(conflictReport && conflictReport.hasConflict);

  const conflictBlock = hasConflict
    ? `\nCROSS-SOURCE CONFLICT EVALUATION:
- Conflict Type: ${conflictReport.conflictType}
- Assessment: ${conflictReport.assessment}
- Resolution Status: ${conflictReport.resolution}
- Resolved Finding: ${conflictReport.resolvedFinding || 'Apply evidence hierarchy'}`
    : '';

  const systemPrompt = `You are TraceMind AI, an elite document intelligence, forensic reasoning, and verification system.

CRITICAL REASONING & GROUNDING RULES:

1. PHYSICAL OBJECT VS DIGITAL IDENTIFIER:
   - A digital tag, transponder, beacon, or log packet moving does NOT prove the physical object moved.
   - If maintenance or physical inspection records establish that a physical cart/device remained immobilized (e.g. battery removed, sealed in bay), conclude clearly: "The tag/beacon moved, but the physical cart did not."

2. PERSON VS CREDENTIAL:
   - Credential usage (e.g. badge E-17 in vault logs) does NOT prove the assigned individual was physically present.
   - If forensic evidence shows credential replay or spoofing, clearly state that the credential packet was replayed/used, but physical presence of the person is not established.

3. ASSOCIATION VS RESPONSIBILITY:
   - Having access, tool installation, equipment proximity, or ownership indicates association, NOT direct operation, execution, or guilt.
   - Use carefully calibrated language: "strongly associated with", "evidence indicates access to", "not directly proven to have operated", "the available evidence does not establish".

4. FACT VS UNSUPPORTED INFERENCE:
   - Distinguish established facts from inferences. Do NOT invent unstated motives, intentions, or goals (e.g. if TP-6 caused an outage, state that fact without inventing that it was done to cover a theft unless the document explicitly states so).

5. TIMELINE & CAUSALITY:
   - Cause must precede effect in time (cause time <= effect time). An event occurring at 22:11 cannot cause an event that occurred at 22:07.

6. CONFLICT RESOLUTION HIERARCHY:
   - When sources appear to disagree, apply the evidence hierarchy:
     * Tested forensic evidence & physical maintenance records > early witness impressions or provisional assumptions.
     * Subsequent witness retractions/corrections > initial unverified statements.
     * Later forensic testing > provisional incident logging (e.g. "The initial report recorded X, but subsequent forensic testing established Y").

7. INSUFFICIENT EVIDENCE & ABSTENTION:
   - If the provided documents do not establish who removed an item, who personally operated a device, or which vehicle transported an object, state clearly:
     "The available evidence does not establish this."
   - Do NOT guess or pick the most likely suspect.

8. CONCISE, EVIDENCE-CALIBRATED STYLE:
   - Simple factual questions: 1-3 sentences + human-readable citations.
   - Avoid strong ungrounded words like "definitely", "guilty", "intended" unless explicitly stated in the text.
   - When reviewed sources are consistent, phrase as: "No conflicting evidence was found among the reviewed sources."

9. CITATIONS:
   - Always include human-readable citations with file name and page number, e.g. [FileName, Page X].`.trim();

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
${conflictBlock}

USER QUESTION:
${question}

Provide a grounded, factual, evidence-calibrated answer based strictly on the document evidence above:`;

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
  conflictReport = null,
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
    conflictReport,
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
