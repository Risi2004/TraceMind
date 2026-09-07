import dotenv from 'dotenv';
import {
  getOllamaBaseUrl,
  isOllamaConfigured,
  getOllamaTextModel,
  callTextModel,
} from './ollama.service.js';

dotenv.config();

/**
 * Qwen LLM Client for RunPod Hosted Ollama Server
 * Enforces strict grounding, citation generation, and anti-hallucination guardrails.
 */

export const getOllamaLlmModel = () => {
  return getOllamaTextModel();
};

/**
 * Build a structured, grounded system & user prompt with document context blocks and forensic reasoning rules
 */
export const buildGroundedPrompt = ({
  question,
  contextChunks = [],
  classifiedClaims = [],
  conflictReport = null,
}) => {
  const hasConflict = Boolean(conflictReport && conflictReport.hasConflict);

  const conflictBlock = hasConflict
    ? `\nCROSS-SOURCE CONFLICT EVALUATION:
- Conflict Type: ${conflictReport.conflictType}
- Assessment: ${conflictReport.assessment}
- Resolution Status: ${conflictReport.resolution}
- Resolved Finding: ${conflictReport.resolvedFinding || 'Apply evidence hierarchy'}`
    : '';

  const claimsBlock =
    classifiedClaims && classifiedClaims.length > 0
      ? `\nCALIBRATED EVIDENCE CLASSIFICATIONS:
${classifiedClaims
  .map(
    (c) =>
      `- [${c.level}] ${c.claim} (${c.source || 'Source'}${
        c.calibrationNote ? ` — ${c.calibrationNote}` : ''
      })`
  )
  .join('\n')}\n`
      : '';

  const systemPrompt = `You are TraceMind AI, an elite document intelligence, forensic reasoning, and verification system.

INTERNAL EVIDENCE CALIBRATION TAXONOMY:
1. VERIFIED FACT: Directly visible in image evidence or explicitly stated in document text.
   - Phrasing: "The evidence directly shows...", "The document explicitly states...", "Directly established by [Source]..."
2. STRONG INFERENCE: Supported independently by multiple consistent pieces of evidence or corroborating sources, but not directly proven by a single explicit statement.
   - Phrasing: "Multiple pieces of evidence support...", "Corroborated across [Source A] and [Source B]..."
3. POSSIBLE INFERENCE: Reasonable deduction, plausible hypothesis, or contextual association based on partial clues, shared context, or timing, but NOT proven.
   - Phrasing: "The evidence suggests...", "Plausibly associated with...", "May be connected to...", "Indicates possible association rather than direct proof..."
4. UNKNOWN / NOT ESTABLISHED: The evidence is insufficient, silent, or unspecified regarding the inquiry.
   - Phrasing: "The available evidence does not establish...", "Cannot be determined from the available records."

MANDATORY REASONING & GROUNDING RULES:

1. NEVER CONVERT AN INFERENCE INTO A VERIFIED FACT:
   - Plausible hypotheses and deductions must remain explicitly marked as inferences. Never declare an inference as an established fact.

2. SHARED ATTRIBUTES RULE (Location, Time, Quantity, Similar Names, Contextual Relationships):
   - If two pieces of evidence ONLY share location, time, quantity, similar names, or contextual relationships:
     * Describe the relationship ONLY as: "plausibly associated", "may be connected", or "evidence suggests".
     * DO NOT assert a direct connection or identity unless direct evidence confirms it.
     * Example:
       - BAD: "AE-7791 is connected to Project Kestrel."
       - GOOD: "AE-7791 is plausibly associated with Project Kestrel because of matching location, timing, and contextual evidence, but no retrieved evidence directly confirms the connection."

3. FORBIDDEN UNSUPPORTED WORDS:
   - NEVER introduce loaded or speculative words such as "illegal", "illicit", "criminal", "classified", "sabotage", "responsible", "guilty" unless retrieved evidence explicitly uses or directly establishes those exact terms.

4. "DOES THIS PROVE...?" QUESTIONS:
   - When the user asks whether evidence proves a conclusion, explicitly distinguish:
     a) What is directly established
     b) What is inferred
     c) What cannot be established / remains unproven

5. CONFLICT HANDLING & SOURCE RELIABILITY:
   - When sources conflict:
     * Explicitly identify and disclose the contradiction.
     * Compare source reliability using the evidence hierarchy (physical maintenance logs & tested forensic analysis > provisional impressions or digital signal assumptions; formal witness retractions / corrections > initial unverified impressions; subsequent forensic test results > initial provisional logging).
     * Explain why the stronger evidence is preferred.
     * Do NOT silently ignore conflicting evidence.
   - If NO conflict exists, do NOT include unsolicited boilerplate like "No conflicting evidence was found".

6. IMAGE EVIDENCE GROUNDING:
   - Only claim what the Vision Analysis Agent actually detected.
   - Do not assume two objects or events are identical just because they appear related or appear in the same scene.
   - Cross-reference image evidence with retrieved text evidence before drawing a combined conclusion.

7. PHYSICAL OBJECTS VS DIGITAL IDENTIFIERS & PERSONS VS CREDENTIALS:
   - A digital tag, transponder, or beacon moving does NOT prove the physical object moved (if maintenance logs show the physical asset remained stationary).
   - Credential or badge usage does NOT prove the assigned individual was physically present (if forensic evidence indicates badge replay/spoofing).
   - Access, equipment proximity, or ownership indicates association, NOT direct operation or responsibility.

8. CITATION INTEGRITY:
   - Keep citations attached directly to the claims they support:
     * For document pages: [FileName, Page X]
     * For visual evidence: [FileName, Image Evidence]

9. ANSWER STRUCTURE & CONCISENESS:
   - For simple factual questions (e.g. "What is the route distance?", "What is the item count?"):
     * Answer directly and concisely (1–3 sentences) with citations. Do NOT add unnecessary meta-analysis.
   - For complex investigation questions (e.g. assessing proof, multi-source discrepancies, "Does this prove...?"):
     * Structure clearly with:
       - **Directly Established**
       - **Reasonable Inferences**
       - **Conflicting or Uncertain Evidence** (if applicable)
       - **Final Conclusion**`.trim();

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
      const isImage = Boolean(
        chunk.isImage ||
        chunk.sourceType === 'image' ||
        /\.(png|jpg|jpeg|webp)$/i.test(fileName)
      );
      const locationLabel = isImage ? 'Image Evidence (Visual Capture)' : `Page: ${chunk.pageNumber || 1}`;
      const score = chunk.similarityScore ? ` (Relevance: ${(chunk.similarityScore * 100).toFixed(1)}%)` : '';

      return `[Source ${sourceNum}]: File: "${fileName}" | ${locationLabel}${score}
"""
${chunk.chunkText}
"""`;
    })
    .join('\n\n');

  const userPrompt = `DOCUMENT EVIDENCE:
${evidenceBlocks}
${claimsBlock}${conflictBlock}
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
 * @param {Array<Object>} [params.classifiedClaims] - Pre-classified claims from Evidence Agent
 * @param {Object} [params.conflictReport] - Conflict detection and resolution report
 * @param {Array<Object>} [params.chatHistory] - Optional prior conversation messages
 * @param {number} [params.temperature=0.1] - Sampling temperature (low for factual grounding)
 * @returns {Promise<string>} Generated grounded response text
 */
export const generateGroundedAnswer = async ({
  question,
  contextChunks = [],
  classifiedClaims = [],
  conflictReport = null,
  chatHistory = [],
  temperature = 0.1,
}) => {
  const model = getOllamaTextModel();

  if (!isOllamaConfigured()) {
    throw new Error(
      'RunPod Ollama is not configured. Please set OLLAMA_BASE_URL in .env.'
    );
  }

  const { systemPrompt, userPrompt } = buildGroundedPrompt({
    question,
    contextChunks,
    classifiedClaims,
    conflictReport,
  });

  // Prepare messages payload for centralized Ollama call
  const messages = [
    { role: 'system', content: systemPrompt },
    // Filter and sanitize recent chat history (keep last 6 turns for context continuity)
    ...chatHistory.slice(-6).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content || '',
    })),
    { role: 'user', content: userPrompt },
  ];

  console.log(`\n🧠 [Qwen Service] Generating grounded answer with model: "${model}" on RunPod...`);
  console.log(`📄 [Qwen Service] Evidence passages provided: ${contextChunks.length}`);

  try {
    const replyText = await callTextModel({
      messages,
      temperature,
    });

    console.log(`✅ [Qwen Service] Answer generated successfully (${replyText.length} characters).\n`);
    return replyText.trim();
  } catch (error) {
    console.error(`❌ [Qwen Service] Error:`, error.message);
    throw error;
  }
};

export default {
  generateGroundedAnswer,
  buildGroundedPrompt,
  getOllamaLlmModel,
};

