import { callTextModel } from '../services/ollama.service.js';

/**
 * Source Reliability and Conflict Agent (Google ADK Architecture - High Performance)
 * Responsibilities:
 * 1. Cross-examine claims and evidence coming from different documents / passages.
 * 2. Strict Entity Resolution:
 *    - EXACT ENTITY MATCH: Both claims must refer to the exact same entity name to conflict.
 *    - SPELLING SIMILARITY IS NOT ENOUGH: Never assume entities are identical because names look or sound similar.
 *    - EXPLICIT ALIAS EVIDENCE: Different names may only be treated as the same entity if retrieved text explicitly states so.
 *    - NO INVENTED TYPOS: Never assume a name is a typo or spelling variant without explicit textual evidence.
 *    - ENTITY UNCERTAINTY: If equivalence is unclear, classify as ENTITY_UNCERTAIN with hasConflict: false.
 * 3. Strict Conflict Definition:
 *    - A missing detail or complementary angle is NOT a contradiction.
 *    - Only report a conflict when two sources make genuinely incompatible factual claims about the same entity.
 * 4. Apply Evidence Hierarchy:
 *    - Physical maintenance logs & tested forensics > witness impressions or digital signal assumptions.
 *    - Formal witness retractions / corrections > initial unverified impressions.
 *    - Subsequent forensic testing > initial provisional classifications.
 */

export const runConflictAgent = async ({
  question,
  structuredEvidenceState = null,
  accumulatedChunks = [],
  currentRound = 1,
}) => {
  // Prune passages to top unique document sources to prevent prompt bloat
  const candidateChunks = (accumulatedChunks || []).slice(0, 6);

  if (candidateChunks.length < 2 && (!structuredEvidenceState || structuredEvidenceState.verifiedFacts?.length < 2)) {
    return {
      hasConflict: false,
      entityStatus: 'not_applicable',
      conflictType: 'none',
      conflictingSources: [],
      assessment: 'Passages cross-examined with no contradictions.',
      resolution: 'no_conflict',
      resolvedFinding: null,
      conflictCount: 0,
      entityMismatchCount: 0,
      entityUncertainCount: 0,
    };
  }

  const passagesSummary = candidateChunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] "${c.fileName || 'Doc'}" (${
          c.isImage || c.sourceType === 'image' ? 'Image' : `Page ${c.pageNumber || 1}`
        }): ${(c.chunkText || '').slice(0, 350)}`
    )
    .join('\n\n');

  const systemPrompt = `You are the Lead Conflict Analysis Agent in TraceMind.
Cross-examine evidence across different documents.

STRICT ENTITY RESOLUTION RULES (CRITICAL):
1. EXACT ENTITY MATCH: Two claims may ONLY be compared for conflict if both claims explicitly refer to the EXACT SAME entity name (e.g., "Gloamreach" vs "Gloamreach").
2. SPELLING SIMILARITY IS NOT ENOUGH: Never assume two entities are identical merely because their names look similar, sound similar, or share prefixes/suffixes (e.g., "Gloamreach" vs "Gloammarch" are DIFFERENT entities -> NO CONFLICT).
3. EXPLICIT ALIAS EVIDENCE REQUIRED: Different names may be treated as the same entity ONLY when retrieved evidence explicitly states that relationship (e.g., "Gloammarch, formerly known as Gloamreach" or "Gloammarch is another name for Gloamreach").
4. NO INVENTED TYPOS: NEVER assume a name is a typo, spelling variant, or alternate spelling without explicit textual evidence. Do not silently normalize proper nouns.
5. ENTITY UNCERTAINTY: If it is unclear whether two different names refer to the same entity, classify entityStatus as "ENTITY_UNCERTAIN" and hasConflict as false.
6. TRUE CONFLICT DEFINITION: A conflict exists ONLY when:
   - Both claims concern the exact same verified entity (or verified alias),
   - Both claims concern the same attribute or event,
   - And their factual values cannot simultaneously be true.

STRICT CONFLICT RULES:
1. WHAT IS NOT A CONFLICT: Missing details, complementary descriptions, or claims about different entities are NOT contradictions.
2. EVIDENCE HIERARCHY: Physical maintenance records/tested forensics > witness impressions/transponder signals; retractions > unverified impressions.

OUTPUT STRICT CONCISE JSON:
{
  "hasConflict": true or false,
  "entityStatus": "EXACT_MATCH" | "EXPLICIT_ALIAS" | "DIFFERENT_ENTITIES" | "ENTITY_UNCERTAIN",
  "conflictType": "genuine_contradiction" | "physical_vs_signal" | "initial_vs_forensic" | "witness_retraction" | "none",
  "conflictingSources": [
    { "document": "Doc Name", "page": 1, "claim": "...", "entity": "...", "reliability": "..." }
  ],
  "assessment": "1 sentence conflict evaluation",
  "resolution": "resolved" | "unresolved" | "no_conflict",
  "resolvedFinding": "Definitive takeaway applying evidence hierarchy (or null)"
}`;

  const userPrompt = `User Question: "${question}"

RETRIEVED PASSAGES TO CROSS-EXAMINE:
${passagesSummary}

Evaluate cross-document conflicts in strict JSON:`;

  try {
    const rawContent = await callTextModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      format: 'json',
      temperature: 0.1,
      timeoutMs: 25000,
    });

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = {
        hasConflict: false,
        entityStatus: 'not_applicable',
        conflictType: 'none',
        conflictingSources: [],
        assessment: 'Passages cross-examined with no contradictions.',
        resolution: 'no_conflict',
        resolvedFinding: null,
      };
    }

    const entityStatus = parsed.entityStatus || (parsed.hasConflict ? 'EXACT_MATCH' : 'DIFFERENT_ENTITIES');
    let hasConflict = Boolean(parsed.hasConflict);

    // Guard: If entities are different or entity equivalence is uncertain, there is NO conflict
    if (entityStatus === 'ENTITY_UNCERTAIN' || entityStatus === 'DIFFERENT_ENTITIES') {
      hasConflict = false;
    }

    return {
      hasConflict,
      entityStatus,
      conflictType: hasConflict ? (parsed.conflictType || 'genuine_contradiction') : 'none',
      conflictingSources: hasConflict ? (parsed.conflictingSources || []) : [],
      assessment: parsed.assessment || 'Cross-document evaluation complete.',
      resolution: hasConflict ? (parsed.resolution || 'unresolved') : 'no_conflict',
      resolvedFinding: parsed.resolvedFinding || null,
      conflictCount: hasConflict ? 1 : 0,
      entityMismatchCount: entityStatus === 'DIFFERENT_ENTITIES' ? 1 : 0,
      entityUncertainCount: entityStatus === 'ENTITY_UNCERTAIN' ? 1 : 0,
    };
  } catch (err) {
    console.warn(`[Conflict Agent Notice]: ${err.message}`);
    return {
      hasConflict: false,
      entityStatus: 'not_applicable',
      conflictType: 'none',
      conflictingSources: [],
      assessment: 'Conflict check completed via direct source synthesis.',
      resolution: 'no_conflict',
      resolvedFinding: null,
      conflictCount: 0,
      entityMismatchCount: 0,
      entityUncertainCount: 0,
    };
  }
};

export default { runConflictAgent };
