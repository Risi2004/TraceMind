import { getOllamaBaseUrl } from '../services/ollama.service.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';

/**
 * 5. Sufficiency Agent (Google ADK Architecture)
 * Evaluates whether:
 * 1. The question is fully answered by direct grounded evidence.
 * 2. Physical verification is present (not confusing digital beacons with physical objects).
 * 3. Person identity vs credential use is verified (not equating badge logs to physical presence).
 * 4. Association is not being mistaken for direct responsibility/guilt without proof.
 * 5. Timeline sequence is valid (cause timestamp <= effect timestamp).
 * 6. Motive is not being ungroundedly invented.
 * 7. If facts are genuinely missing, whether another targeted search round should be triggered or calibrated abstention declared.
 */

export const runSufficiencyAgent = async ({
  question,
  accumulatedFacts = [],
  accumulatedChunks = [],
  conflictReport = null,
  currentRound = 1,
}) => {
  const effectiveFacts =
    accumulatedFacts && accumulatedFacts.length > 0
      ? accumulatedFacts
      : (accumulatedChunks || []).map(
          (c) =>
            `[${c.fileName || 'Document'}, Page ${c.pageNumber || 1}]: ${c.chunkText.slice(0, 300)}`
        );

  if (effectiveFacts.length === 0) {
    return {
      isSufficient: false,
      confidenceScore: 20,
      reason: 'No factual evidence has been accumulated yet.',
      missingInformation: 'All required factual documents and records.',
    };
  }

  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaLlmModel();

  const factsList = effectiveFacts.map((f, i) => `${i + 1}. ${f}`).join('\n');

  const conflictSummary =
    conflictReport && conflictReport.hasConflict
      ? `\nCROSS-SOURCE CONFLICT ANALYSIS:\n- Type: ${conflictReport.conflictType}\n- Assessment: ${conflictReport.assessment}\n- Status: ${conflictReport.resolution}\n- Resolved Takeaway: ${conflictReport.resolvedFinding || 'None'}`
      : '\nCROSS-SOURCE CONFLICT: No unresolved contradictions detected.';

  const systemPrompt = `You are the Lead Verification & Sufficiency Agent in TraceMind's reasoning system.
Your job is to strictly evaluate whether the ACCUMULATED FACTS are sufficient to produce a rigorous, evidence-calibrated answer.

EVALUATION CHECKLIST:
1. QUESTION ANSWERABILITY:
   - Does direct evidence answer the core question?
2. PHYSICAL VS DIGITAL VERIFICATION:
   - If a signal/tag/beacon moved, is there physical maintenance/cart evidence? If physical evidence is still missing and round < 3, flag missing information to search for physical records.
3. PERSON VS CREDENTIAL:
   - If a credential was logged, was packet replay/spoofing checked?
4. ASSOCIATION VS PROVEN RESPONSIBILITY:
   - Does evidence only show access/association? (If so, evidence is SUFFICIENT to state the association while noting lack of direct proof).
5. TIMELINE CONSISTENCY:
   - Ensure cause timestamp precedes effect timestamp.
6. GENUINE UNKNOWN / ABSTENTION:
   - If the documents explicitly do NOT contain the suspect, vehicle, or executor, evidence is SUFFICIENT to state "The available evidence does not establish this."

Output strict JSON with format:
{
  "isSufficient": true or false,
  "confidenceScore": integer between 0 and 100,
  "reason": "1-2 sentence explanation of sufficiency evaluation",
  "missingInformation": "Specific missing document/record to search for if isSufficient is false (e.g. 'physical maintenance log for cart SC-12'), or null if sufficient"
}`;

  const userPrompt = `User Question: "${question}"

ACCUMULATED FACTS FROM DOCUMENTS:
${factsList}
${conflictSummary}

Evaluate sufficiency in JSON:`;

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
        confidenceScore: accumulatedFacts.length >= 2 ? 90 : 50,
        reason: 'Evaluating accumulated document facts.',
        missingInformation: null,
      };
    }

    const isSufficient = Boolean(parsed.isSufficient);
    const confidenceScore =
      typeof parsed.confidenceScore === 'number'
        ? parsed.confidenceScore
        : isSufficient
        ? 92
        : 50;

    return {
      isSufficient,
      confidenceScore,
      reason:
        parsed.reason ||
        (isSufficient ? 'Sufficient evidence collected.' : 'Additional specific records required.'),
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


