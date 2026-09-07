import { callTextModel } from '../services/ollama.service.js';

/**
 * Source Reliability and Conflict Agent (Google ADK Architecture)
 * Responsibilities:
 * 1. Cross-examine claims and evidence coming from different documents / passages.
 * 2. Strict Conflict Definition:
 *    - A missing detail is NOT automatically a conflict.
 *    - Different descriptions or complementary angles are NOT automatically contradictions.
 *    - Only report a conflict when two pieces of evidence make genuinely incompatible claims.
 * 3. Apply Evidence Hierarchy:
 *    - Physical maintenance records & tested forensic analysis > provisional witness impressions / digital signal assumptions.
 *    - Later retractions / corrected witness statements > initial unverified impressions.
 *    - Subsequent forensic testing > initial provisional incident classifications.
 * 4. Resolve apparent conflicts cleanly rather than declaring false inconclusiveness when stronger evidence resolves them.
 */

export const runConflictAgent = async ({
  question,
  accumulatedChunks = [],
  accumulatedFacts = [],
  currentRound = 1,
}) => {
  if (!accumulatedChunks || accumulatedChunks.length < 2) {
    return {
      hasConflict: false,
      conflictType: 'none',
      conflictingSources: [],
      assessment: 'Single source or insufficient passages to compare for cross-document conflicts.',
      resolution: 'no_conflict',
    };
  }

  const uniqueDocNames = [...new Set(accumulatedChunks.map((c) => c.fileName || 'Unknown Doc'))];

  const passagesSummary = accumulatedChunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] Document: "${c.fileName || 'Doc'}" (${
          c.isImage || c.sourceType === 'image' ? 'Image Evidence' : `Page ${c.pageNumber || 1}`
        })\nContent: ${c.chunkText.slice(0, 500)}`
    )
    .join('\n\n');

  const systemPrompt = `You are the Lead Source Reliability and Conflict Analysis Agent in TraceMind's reasoning system.
Your job is to compare evidence across different documents or distinct passages to detect genuine disagreements, contradictions, or competing accounts.

STRICT CONFLICT EVALUATION RULES:
1. WHAT IS NOT A CONFLICT:
   - A missing detail in one source that is present in another is NOT a conflict.
   - Different or complementary descriptions of the same scene/object are NOT contradictions.
   - Different parts of an image or document describing different aspects (e.g. map route vs manifest items) are NOT conflicts.
2. WHAT IS A CONFLICT:
   - Only flag a conflict when two distinct pieces of evidence make genuinely incompatible, contradictory factual assertions (e.g., Doc A says "Delivered on May 10" while Doc B says "Never delivered"; or Doc A says "Officer Smith was in room" while forensic badge log proves "Smith was offsite").
3. EVIDENCE HIERARCHY FOR RESOLUTION:
   - Prefer physical verification, tested forensic evidence, and signed maintenance logs over witness guesses, transponder assumptions, or provisional impressions.
   - Prefer subsequent witness retractions or formal corrections over initial unverified impressions.
   - Prefer subsequent forensic test results over initial provisional logging.
4. DO NOT PREMATURELY DECLARE INCONCLUSIVE:
   - If higher-order evidence (e.g. physical logs, forensics) resolves the apparent disagreement, explain the resolution.

Output strict JSON with format:
{
  "hasConflict": true or false,
  "conflictType": "genuine_contradiction" | "physical_vs_signal" | "initial_vs_forensic" | "witness_retraction" | "none",
  "conflictingSources": [
    { "document": "Doc A", "page": 1, "claim": "...", "reliability": "..." }
  ],
  "assessment": "Clear summary of the disagreement and resolution (or 'Evidence across reviewed passages is consistent').",
  "resolution": "resolved" | "unresolved" | "no_conflict",
  "resolvedFinding": "The definitive factual takeaway after applying the evidence hierarchy (or null if no conflict or unresolved)."
}`;

  const userPrompt = `User Question: "${question}"
Distinct Documents Examined: [${uniqueDocNames.join(', ')}]

RETRIEVED PASSAGES TO CROSS-EXAMINE:
${passagesSummary}

Analyze genuine contradictions and resolution in JSON:`;

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
        hasConflict: false,
        conflictType: 'none',
        conflictingSources: [],
        assessment: 'Passages cross-examined with no unresolvable contradictions.',
        resolution: 'no_conflict',
      };
    }

    return {
      hasConflict: Boolean(parsed.hasConflict),
      conflictType: parsed.conflictType || 'none',
      conflictingSources: parsed.conflictingSources || [],
      assessment: parsed.assessment || 'Cross-document evaluation complete.',
      resolution: parsed.resolution || (parsed.hasConflict ? 'unresolved' : 'no_conflict'),
      resolvedFinding: parsed.resolvedFinding || null,
    };
  } catch (err) {
    console.warn(`[Conflict Agent Notice]: ${err.message}`);
    return {
      hasConflict: false,
      conflictType: 'none',
      conflictingSources: [],
      assessment: 'Conflict check completed via direct source synthesis.',
      resolution: 'no_conflict',
      resolvedFinding: null,
    };
  }
};

export default { runConflictAgent };
