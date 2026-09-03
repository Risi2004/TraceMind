import { getOllamaBaseUrl } from '../services/ollama.service.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';

/**
 * 5. Sufficiency Agent (Google ADK Architecture)
 * Evaluates whether all aspects of the user's question have been answered by the accumulated evidence
 * and checks if unresolved source conflicts require additional search rounds.
 */

export const runSufficiencyAgent = async ({
  question,
  accumulatedFacts = [],
  conflictReport = null,
  currentRound = 1,
}) => {
  if (!accumulatedFacts || accumulatedFacts.length === 0) {
    return {
      isSufficient: false,
      confidenceScore: 30,
      reason: 'No factual evidence has been accumulated yet.',
      missingInformation: 'All required facts to answer the question.',
    };
  }

  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaLlmModel();

  const factsList = accumulatedFacts.map((f, i) => `${i + 1}. ${f}`).join('\n');
  const conflictSummary = conflictReport && conflictReport.hasConflict
    ? `\nSOURCE CONFLICT DETECTED:\n- Type: ${conflictReport.conflictType}\n- Assessment: ${conflictReport.assessment}\n- Status: ${conflictReport.resolution}`
    : '\nSOURCE CONFLICT: None detected across sources.';

  const systemPrompt = `You are the Lead Verification & Sufficiency Agent in TraceMind's multi-hop reasoning system.
Your job is to strictly judge whether the provided ACCUMULATED FACTS and SOURCE CONFLICT STATUS are sufficient to answer the user's question completely and accurately.

CRITICAL RULES:
- Output strict JSON with format:
  "isSufficient": true or false,
  "confidenceScore": integer between 0 and 100,
  "reason": "1 sentence explanation of why evidence is or is not sufficient",
  "missingInformation": "Specific missing entities, numbers, dates, or details if isSufficient is false, or null if isSufficient is true"
- If evidence answers the query (even if sources disagree and both perspectives are documented), isSufficient can be TRUE so the Answer Agent can present the conflicting perspectives with citations.
- Output valid JSON only with no extra commentary.`;

  const userPrompt = `User Question: "${question}"

ACCUMULATED FACTS FROM DOCUMENTS:
${factsList}
${conflictSummary}

Judge sufficiency in JSON:`;

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
        options: { temperature: 0.1, num_ctx: 4096 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Sufficiency LLM call failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.message?.content || data.response || '{}';

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = {
        isSufficient: accumulatedFacts.length >= 2,
        confidenceScore: accumulatedFacts.length >= 2 ? 88 : 50,
        reason: 'Evaluating accumulated document facts.',
        missingInformation: null,
      };
    }

    const isSufficient = Boolean(parsed.isSufficient);
    const confidenceScore = typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : (isSufficient ? 90 : 50);

    return {
      isSufficient,
      confidenceScore,
      reason: parsed.reason || (isSufficient ? 'Sufficient evidence collected.' : 'Additional details needed.'),
      missingInformation: parsed.missingInformation || (isSufficient ? null : 'Unresolved specifics.'),
    };
  } catch (err) {
    console.warn(`[Sufficiency Agent Notice]: ${err.message}`);
    const isSufficient = accumulatedFacts.length > 0;
    return {
      isSufficient,
      confidenceScore: isSufficient ? 85 : 40,
      reason: 'Rule-based sufficiency check.',
      missingInformation: isSufficient ? null : 'Further verification needed.',
    };
  }
};

export default { runSufficiencyAgent };

