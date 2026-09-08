import { callTextModel } from '../services/ollama.service.js';

/**
 * 5. Sufficiency Agent (Google ADK Architecture - High Performance)
 * Evaluates whether:
 * 1. The core question is directly answered by verified facts.
 * 2. Unresolved conflicts are present.
 * 3. Whether follow-up search is required or calibrated answer should be synthesized.
 */

export const runSufficiencyAgent = async ({
  question,
  structuredEvidenceState = null,
  accumulatedFacts = [],
  classifiedClaims = [],
  conflictReport = null,
  hasDirectVerifiedAnswer = false,
  currentRound = 1,
}) => {
  const verifiedFacts = structuredEvidenceState?.verifiedFacts || accumulatedFacts || [];

  // Immediate fast path: if direct verified answer exists and no unresolved conflicts
  if (hasDirectVerifiedAnswer && (!conflictReport || !conflictReport.hasConflict || conflictReport.resolution === 'resolved')) {
    return {
      isSufficient: true,
      confidenceScore: 96,
      reason: 'DIRECT_VERIFIED_FACT',
      missingInformation: null,
    };
  }

  if (verifiedFacts.length === 0) {
    return {
      isSufficient: false,
      confidenceScore: 20,
      reason: 'EVIDENCE_INSUFFICIENT',
      missingInformation: 'Key records or document passages for inquiry.',
    };
  }

  const factsList = verifiedFacts.slice(0, 6).map((f, i) => `${i + 1}. ${f}`).join('\n');
  const conflictText = conflictReport && conflictReport.hasConflict
    ? `Conflict: ${conflictReport.conflictType} (${conflictReport.assessment})`
    : 'No conflicts detected.';

  const systemPrompt = `You are the Lead Sufficiency Agent in TraceMind.
Evaluate whether the evidence is sufficient to produce an accurate, grounded answer.

SUFFICIENCY RULES:
1. If a VERIFIED FACT directly answers the requested entity, year, date, number, location, or name with source citations, mark isSufficient = true (reason: "DIRECT_VERIFIED_FACT").
2. If evidence proves the answer is unknown/unrecorded, mark isSufficient = true so the Answer Agent can state it is not established.
3. Only mark isSufficient = false when crucial missing facts could realistically be located with another targeted query.

OUTPUT STRICT CONCISE JSON:
{
  "isSufficient": true or false,
  "confidenceScore": 0 to 100,
  "reason": "DIRECT_VERIFIED_FACT" | "EVIDENCE_SUFFICIENT" | "MORE_EVIDENCE_NEEDED",
  "missingInformation": "Target of next query if isSufficient is false (or null)"
}`;

  const userPrompt = `User Question: "${question}"
ACCUMULATED FACTS:
${factsList}
${conflictText}

Evaluate sufficiency in strict JSON:`;

  try {
    const rawContent = await callTextModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      format: 'json',
      temperature: 0.1,
      timeoutMs: 20000,
    });

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = {
        isSufficient: verifiedFacts.length >= 1,
        confidenceScore: verifiedFacts.length >= 1 ? 92 : 50,
        reason: 'EVALUATED_DOCUMENT_FACTS',
        missingInformation: null,
      };
    }

    const isSufficient = Boolean(parsed.isSufficient);

    return {
      isSufficient,
      confidenceScore: parsed.confidenceScore || (isSufficient ? 95 : 50),
      reason: parsed.reason || (isSufficient ? 'EVIDENCE_SUFFICIENT' : 'MORE_EVIDENCE_NEEDED'),
      missingInformation: parsed.missingInformation || (isSufficient ? null : 'Unresolved specifics.'),
    };
  } catch (err) {
    console.warn(`[Sufficiency Agent Notice]: ${err.message}`);
    const isSufficient = verifiedFacts.length >= 2;
    return {
      isSufficient,
      confidenceScore: isSufficient ? 90 : 50,
      reason: isSufficient ? 'EVIDENCE_SUFFICIENT' : 'MORE_EVIDENCE_NEEDED',
      missingInformation: isSufficient ? null : 'Additional records required.',
    };
  }
};

export default { runSufficiencyAgent };
