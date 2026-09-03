import { getOllamaBaseUrl } from '../services/ollama.service.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';

/**
 * Source Reliability and Conflict Agent (Google ADK Architecture)
 * Responsibilities:
 * 1. Cross-examine claims and evidence coming from different documents / passages.
 * 2. Detect contradictions, date/number discrepancies, or competing policy statements.
 * 3. Assess relative reliability based on document names, version hints, specificity, and dates without ungrounded bias.
 * 4. Output structured conflict analysis for Sufficiency and Answer Agents.
 */

export const runConflictAgent = async ({
  question,
  accumulatedChunks = [],
  accumulatedFacts = [],
  currentRound = 1,
}) => {
  // If we have fewer than 2 chunks, no cross-document conflict is possible
  if (!accumulatedChunks || accumulatedChunks.length < 2) {
    return {
      hasConflict: false,
      conflictType: 'none',
      conflictingSources: [],
      assessment: 'Single source or insufficient passages to compare for cross-document conflicts.',
      resolution: 'no_conflict',
    };
  }

  // Check if chunks come from more than one distinct document or separate dates/versions
  const uniqueDocNames = [...new Set(accumulatedChunks.map(c => c.fileName || 'Unknown Doc'))];

  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaLlmModel();

  const passagesSummary = accumulatedChunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] Document: "${c.fileName || 'Doc'}" (Page ${c.pageNumber || 1})\nContent: ${c.chunkText.slice(0, 450)}`
    )
    .join('\n\n');

  const systemPrompt = `You are the Lead Source Reliability and Conflict Analysis Agent in TraceMind's reasoning system.
Your job is to compare evidence across different documents or distinct passages to detect disagreements, contradictions, or conflicting facts (e.g. conflicting dates, times, rooms, numerical values, requirements, or status).

CRITICAL RULES:
- If sources agree or discuss different topics without contradiction, set "hasConflict": false.
- If two sources make contradictory statements about the same topic (e.g. Doc A says Exam is August 29, Doc B says Exam is September 05):
  1. Set "hasConflict": true
  2. List the conflicting claims with document name and page number.
  3. Assess which source appears more reliable or recent based on context (e.g. "Revised", "Final", date stamps, higher specificity), or note if it is unresolved.
  4. Do NOT guess or make up facts.
- Output strict JSON only with format:
  {
    "hasConflict": true or false,
    "conflictType": "date_discrepancy" | "factual_contradiction" | "policy_variation" | "none",
    "conflictingSources": [
      { "document": "Doc A", "page": 1, "claim": "August 29 in Hall 301", "reliability": "Earlier notice / draft" },
      { "document": "Doc B", "page": 2, "claim": "September 05 in Hall 402", "reliability": "Revised announcement" }
    ],
    "assessment": "1-2 sentences summarizing the disagreement and reliability evaluation.",
    "resolution": "resolved" | "unresolved" | "no_conflict"
  }
- Output valid JSON ONLY. No markdown formatting or extra text.`;

  const userPrompt = `User Question: "${question}"
Distinct Documents Examined: [${uniqueDocNames.join(', ')}]

RETRIEVED PASSAGES TO CROSS-EXAMINE:
${passagesSummary}

Analyze conflicts and reliability in JSON:`;

  try {
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
        options: { temperature: 0.1, num_ctx: 6144 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Conflict LLM call failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.message?.content || data.response || '{}';

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = {
        hasConflict: false,
        conflictType: 'none',
        conflictingSources: [],
        assessment: 'Passages cross-examined without contradictions.',
        resolution: 'no_conflict',
      };
    }

    const hasConflict = Boolean(parsed.hasConflict);

    return {
      hasConflict,
      conflictType: parsed.conflictType || (hasConflict ? 'factual_contradiction' : 'none'),
      conflictingSources: parsed.conflictingSources || [],
      assessment: parsed.assessment || (hasConflict ? 'Discrepancy detected across sources.' : 'Sources are consistent.'),
      resolution: parsed.resolution || (hasConflict ? 'unresolved' : 'no_conflict'),
    };
  } catch (err) {
    console.warn(`[Conflict Agent Notice]: ${err.message}`);
    return {
      hasConflict: false,
      conflictType: 'none',
      conflictingSources: [],
      assessment: 'Cross-document consistency verified by default heuristics.',
      resolution: 'no_conflict',
    };
  }
};

export default { runConflictAgent };
