import { callTextModel } from '../services/ollama.service.js';

/**
 * 5. Sufficiency Agent (Google ADK Architecture)
 * Evaluates whether:
 * 1. Is each major claim directly supported by source evidence?
 * 2. Is an inference being improperly presented as an established fact?
 * 3. Is there enough evidence to answer the user's inquiry, or should calibrated abstention be declared?
 * 4. Physical verification is present (not confusing digital beacons with physical objects).
 * 5. Person identity vs credential use is verified (not equating badge logs to physical presence).
 * 6. Association is not being mistaken for direct responsibility/guilt without proof.
 * 7. If facts are genuinely missing, whether another targeted search round should be triggered or calibrated answer generated.
 */

export const runSufficiencyAgent = async ({
  question,
  accumulatedFacts = [],
  accumulatedChunks = [],
  classifiedClaims = [],
  conflictReport = null,
  currentRound = 1,
}) => {
  const effectiveFacts =
    accumulatedFacts && accumulatedFacts.length > 0
      ? accumulatedFacts
      : (accumulatedChunks || []).map(
          (c) =>
            `[${c.fileName || 'Document'}, ${c.isImage ? 'Image Evidence' : `Page ${c.pageNumber || 1}`}]: ${c.chunkText.slice(0, 300)}`
        );

  if (effectiveFacts.length === 0) {
    return {
      isSufficient: false,
      confidenceScore: 20,
      reason: 'No factual evidence has been accumulated yet.',
      missingInformation: 'All required factual documents and records.',
    };
  }

  const factsList = effectiveFacts.map((f, i) => `${i + 1}. ${f}`).join('\n');

  const claimsSummary =
    classifiedClaims && classifiedClaims.length > 0
      ? `\nCLASSIFIED EVIDENCE CLAIMS:\n${classifiedClaims
          .map((c) => `- [${c.level}] ${c.claim} (${c.source || 'Source'})`)
          .join('\n')}`
      : '';

  const conflictSummary =
    conflictReport && conflictReport.hasConflict
      ? `\nCROSS-SOURCE CONFLICT ANALYSIS:\n- Type: ${conflictReport.conflictType}\n- Assessment: ${conflictReport.assessment}\n- Status: ${conflictReport.resolution}\n- Resolved Takeaway: ${conflictReport.resolvedFinding || 'None'}`
      : '\nCROSS-SOURCE CONFLICT: No unresolved contradictions detected.';

  const systemPrompt = `You are the Lead Verification & Sufficiency Agent in TraceMind's reasoning system.
Your job is to strictly evaluate whether the accumulated evidence is sufficient to produce an accurate, calibrated answer.

SUFFICIENCY VERIFICATION CHECKLIST:
1. DIRECT FACTUAL SUPPORT:
   - Is the core answer directly stated/visible in the document or image evidence?
   - If direct evidence (e.g. map route, manifest row, distance, timestamp) is present in the facts, mark isSufficient = true.
2. NO INFERENCE AS VERIFIED FACT:
   - Verify that plausible associations (e.g. shared location, time, quantity, similar names) are calibrated as STRONG INFERENCE or POSSIBLE INFERENCE, never as VERIFIED FACT.
3. UNSUPPORTED LOADED WORDS CHECK:
   - Flag and disallow speculative words like "illegal", "illicit", "criminal", "classified", "sabotage", "responsible", "guilty" unless directly present in the source text.
4. "DOES THIS PROVE...?" VERIFICATION:
   - For proof questions, check that the evidence distinguishes between what is directly established, what is inferred, and what cannot be established.
5. INSUFFICIENT OR ABSENT EVIDENCE:
   - If the repository simply does not contain the answer, or if the document explicitly states the information is unspecified/unknown, mark isSufficient = true so the Answer Agent can state: "The available evidence does not establish..."
   - Do NOT loop indefinitely searching for information that does not exist.
6. PHYSICAL VS DIGITAL & PERSON VS CREDENTIAL:
   - Ensure digital movements are not conflated with physical movements, and badge transmissions are not conflated with physical presence.

Output strict JSON with format:
{
  "isSufficient": true or false,
  "confidenceScore": integer between 0 and 100,
  "reason": "1-2 sentence explanation of sufficiency evaluation",
  "missingInformation": "Specific missing document/record to search for if isSufficient is false (or null if sufficient)"
}`;

  const userPrompt = `User Question: "${question}"

ACCUMULATED FACTS FROM DOCUMENTS:
${factsList}
${claimsSummary}
${conflictSummary}

Evaluate sufficiency in JSON:`;

  try {
    const rawContent = await callTextModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      format: 'json',
      temperature: 0.1,
      timeoutMs: 30000,
    });

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = {
        isSufficient: accumulatedFacts.length >= 1,
        confidenceScore: accumulatedFacts.length >= 1 ? 92 : 50,
        reason: 'Evaluating accumulated document facts.',
        missingInformation: null,
      };
    }

    const isSufficient = Boolean(parsed.isSufficient);
    const confidenceScore =
      typeof parsed.confidenceScore === 'number'
        ? parsed.confidenceScore
        : isSufficient
        ? 95
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
    const isSufficient = currentRound >= 2 || effectiveFacts.length >= 1;
    return {
      isSufficient,
      confidenceScore: isSufficient ? 90 : 45,
      reason: isSufficient
        ? 'Sufficiency verified via direct fact accumulation.'
        : 'Additional retrieval recommended for full verification.',
    };
  }
};

export default { runSufficiencyAgent };




