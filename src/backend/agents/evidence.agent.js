import { getOllamaBaseUrl } from '../services/ollama.service.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';

/**
 * 3. Evidence Analysis Agent (Google ADK Architecture)
 * Evaluates retrieved chunks, extracts verified factual claims, and classifies:
 * - Physical objects vs digital identifiers/tags/signals
 * - People vs credential packets/badge logs
 * - Direct execution vs association/proximity
 * - Explicit facts vs unsupported inferences
 * - Timestamps and sequential event order
 */

export const runEvidenceAgent = async ({ question, newChunks = [], currentRound = 1 }) => {
  if (!newChunks || newChunks.length === 0) {
    return {
      round: currentRound,
      extractedFacts: [],
      summary: 'No new unique document chunks were found in this round.',
    };
  }

  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaLlmModel();

  const passagesText = newChunks
    .map(
      (chunk, idx) =>
        `[Passage ${idx + 1}] File: "${chunk.fileName || 'Document'}" (Page ${chunk.pageNumber || 1})\n${chunk.chunkText}`
    )
    .join('\n\n');

  const systemPrompt = `You are the Lead Evidence Analysis Agent in TraceMind's reasoning pipeline.
Your job is to analyze retrieved document passages and extract rigorous, verified factual statements.

REASONING & EXTRACTION RULES:
1. PHYSICAL OBJECT VS DIGITAL IDENTIFIER:
   - Differentiate between a digital tag, beacon, transponder, or log entry moving vs the physical object itself moving.
2. PERSON VS CREDENTIAL:
   - Differentiate between a credential/badge/key packet transmission vs the physical person being present.
3. ASSOCIATION VS RESPONSIBILITY:
   - Distinguish access, proximity, or possession from direct physical operation or guilt.
4. FACT VS INFERENCE:
   - Extract only explicit observations and statements. Do NOT infer unstated motives or causes.
5. TIMESTAMPS:
   - Preserve exact timestamps, dates, and sequence markers.
6. CITATIONS:
   - Always link facts to their exact human-readable source: [FileName, Page X].

Output strict JSON with format:
{
  "extractedFacts": [
    "Fact statement with [FileName, Page X]"
  ],
  "evidenceSummary": "Concise 1-2 sentence factual summary.",
  "physicalVsDigitalObservations": "Notes if digital tags vs physical objects are discussed (or null)",
  "personVsCredentialObservations": "Notes if credentials vs physical presence are discussed (or null)",
  "timelineItems": ["22:07 - Event A [FileName, Page X]"]
}`;

  const userPrompt = `User Question: "${question}"

DOCUMENT PASSAGES:
${passagesText}

Extract verified facts with human-readable citations in JSON:`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        format: 'json',
        options: { temperature: 0.1, num_predict: 384, num_ctx: 4096 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Evidence LLM call failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.message?.content || data.response || '{}';

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = {
        extractedFacts: newChunks.slice(0, 3).map(
          (c) =>
            `[${c.fileName || 'Document'}, Page ${c.pageNumber || 1}]: ${c.chunkText.slice(0, 150)}...`
        ),
        evidenceSummary: `Extracted facts from ${newChunks.length} evidence passages.`,
      };
    }

    return {
      round: currentRound,
      extractedFacts: parsed.extractedFacts || [],
      summary: parsed.evidenceSummary || `Analyzed ${newChunks.length} document chunk(s).`,
      physicalVsDigital: parsed.physicalVsDigitalObservations || null,
      personVsCredential: parsed.personVsCredentialObservations || null,
      timelineItems: parsed.timelineItems || [],
      analyzedChunksCount: newChunks.length,
    };
  } catch (err) {
    console.warn(`[Evidence Agent Notice]: ${err.message}. Using direct chunk extraction.`);
    const fallbackFacts = (newChunks || []).slice(0, 5).map(
      (c) => `[${c.fileName || 'Document'}, Page ${c.pageNumber || 1}]: ${c.chunkText.slice(0, 300)}`
    );
    return {
      round: currentRound,
      extractedFacts: fallbackFacts,
      summary: `Analyzed ${newChunks.length} chunk(s) directly from retrieved documents.`,
      analyzedChunksCount: newChunks.length,
    };
  }
};

export default { runEvidenceAgent };
