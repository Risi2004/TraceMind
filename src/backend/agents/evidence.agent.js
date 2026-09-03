import { getOllamaBaseUrl } from '../services/ollama.service.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';

/**
 * 3. Evidence Analysis Agent (Google ADK Architecture)
 * Evaluates retrieved chunks, extracts verified factual claims, and links exact page citations.
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
    .map((chunk, idx) => `[Passage ${idx + 1}] File: "${chunk.fileName}" (Page ${chunk.pageNumber || 1})\n${chunk.chunkText}`)
    .join('\n\n');

  const systemPrompt = `You are the Evidence Extraction Agent in TraceMind's verification pipeline.
Your job is to analyze retrieved document passages and extract only the relevant, factual statements directly answering or related to the user's question.

CRITICAL RULES:
- Output strict JSON with format:
  "extractedFacts": [
    "Fact 1 with [File Name, Page X]",
    "Fact 2 with [File Name, Page X]"
  ],
  "evidenceSummary": "Concise 1-2 sentence summary of what facts were verified in these passages."
- Extract ONLY facts clearly stated in the text. Do not make assumptions.
- Output valid JSON only with no surrounding markdown ticks or commentary.`;

  const userPrompt = `User Question: "${question}"

DOCUMENT PASSAGES:
${passagesText}

Extract verified facts in JSON:`;

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
        extractedFacts: newChunks.slice(0, 3).map(c => `Extracted evidence from ${c.fileName} (Page ${c.pageNumber || 1}): ${c.chunkText.slice(0, 150)}...`),
        evidenceSummary: `Extracted ${newChunks.length} evidence passages.`,
      };
    }

    return {
      round: currentRound,
      extractedFacts: parsed.extractedFacts || [],
      summary: parsed.evidenceSummary || `Analyzed ${newChunks.length} document chunk(s).`,
      analyzedChunksCount: newChunks.length,
    };
  } catch (err) {
    console.warn(`[Evidence Agent Notice]: ${err.message}. Using direct chunk extraction.`);
    const fallbackFacts = (newChunks || []).slice(0, 5).map(
      (c) => `[${c.fileName}, Page ${c.pageNumber || 1}]: ${c.chunkText.slice(0, 300)}`
    );
    return {
      round: currentRound,
      extractedFacts: fallbackFacts,
      summary: `Extracted ${fallbackFacts.length} factual passage(s) from retrieved documents.`,
      analyzedChunksCount: newChunks.length,
    };
  }
};

export default { runEvidenceAgent };
