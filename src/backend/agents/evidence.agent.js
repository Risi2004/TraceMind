import { callTextModel } from '../services/ollama.service.js';

/**
 * 3. Evidence Analysis Agent (Google ADK Architecture)
 * Evaluates retrieved chunks, extracts verified factual claims, and classifies:
 * - Evidence Levels for all claims:
 *   1. EXPLICIT: directly visible or explicitly stated in the source.
 *   2. CORROBORATED: supported independently by multiple pieces of evidence.
 *   3. INFERRED: reasonable conclusion based on evidence, but not directly proven.
 *   4. UNKNOWN: evidence is insufficient to determine the answer.
 * - Physical objects vs digital identifiers/tags/signals
 * - People vs credential packets/badge logs
 * - Direct execution vs association/proximity
 * - Explicit facts vs unsupported inferences (never convert inference into fact)
 * - Timestamps and sequential event order
 */

export const runEvidenceAgent = async ({ question, newChunks = [], currentRound = 1 }) => {
  if (!newChunks || newChunks.length === 0) {
    return {
      round: currentRound,
      extractedFacts: [],
      classifiedClaims: [],
      summary: 'No new unique document chunks were found in this round.',
    };
  }

  const passagesText = newChunks
    .map(
      (chunk, idx) =>
        `[Passage ${idx + 1}] File: "${chunk.fileName || 'Document'}" (${
          chunk.isImage || chunk.sourceType === 'image' ? 'Image Evidence' : `Page ${chunk.pageNumber || 1}`
        })\n${chunk.chunkText}`
    )
    .join('\n\n');

  const systemPrompt = `You are the Lead Evidence Analysis Agent in TraceMind's reasoning pipeline.
Your job is to analyze retrieved document passages and extract rigorous, verified factual statements and classify claims according to four evidence calibration levels.

FOUR EVIDENCE CALIBRATION LEVELS:
1. VERIFIED FACT: Directly visible in image evidence or explicitly stated in document text.
2. STRONG INFERENCE: Supported independently by multiple consistent pieces of evidence or corroborating sources, but not directly stated as a single proven fact.
3. POSSIBLE INFERENCE: Reasonable deduction, plausible hypothesis, or contextual association (e.g. shared location, time, quantity, or similar names), but NOT proven.
4. UNKNOWN / NOT ESTABLISHED: The evidence is insufficient, silent, or unspecified regarding the claim.

CRITICAL CALIBRATION & EXTRACTION RULES:
1. NEVER CONVERT AN INFERENCE INTO A VERIFIED FACT:
   - Example:
     * "AE-7785 contains 20 crates" -> VERIFIED FACT
     * "AE PROPERTY crates are visible at Blackridge" -> VERIFIED FACT
     * "The photographed AE PROPERTY crates are AE-7785" -> POSSIBLE INFERENCE (plausible association, not directly proven)
     * "Specific contents of AE-7785 crates" -> UNKNOWN / NOT ESTABLISHED
2. SHARED ATTRIBUTES RULE (Location, Time, Quantity, Similar Names, Context):
   - If two pieces of evidence only share location, time, quantity, similar names, or contextual relationships, describe them ONLY as "plausibly associated", "may be connected", or "evidence suggests" unless direct evidence proves the connection.
   - Never say "the shared location proves a direct connection".
3. NO UNSUPPORTED LOADED WORDS:
   - Never introduce words such as "illegal", "illicit", "criminal", "classified", "sabotage", "responsible", "guilty" unless retrieved evidence explicitly uses or directly establishes them.
4. IMAGE EVIDENCE GROUNDING:
   - Only claim what the visual analysis actually detected. Do not assume two objects or events are identical just because they look similar or appear in the same scene. Cross-reference image evidence with text before drawing conclusions.
5. PHYSICAL OBJECT VS DIGITAL IDENTIFIER:
   - Differentiate between a digital tag/beacon/transponder moving vs the physical object itself moving.
6. PERSON VS CREDENTIAL:
   - Differentiate between a credential packet/badge transmission vs the physical person being present.
7. ASSOCIATION VS RESPONSIBILITY:
   - Distinguish access, proximity, or possession from direct physical operation, execution, or guilt.
8. TIMESTAMPS & CITATIONS:
   - Preserve exact timestamps and always link facts to their exact human-readable source: [FileName, Page X] or [FileName, Image Evidence].

Output strict JSON with format:
{
  "classifiedClaims": [
    {
      "claim": "Factual statement",
      "level": "VERIFIED FACT" | "STRONG INFERENCE" | "POSSIBLE INFERENCE" | "UNKNOWN / NOT ESTABLISHED",
      "source": "[FileName, Page X] or [FileName, Image Evidence]",
      "calibrationNote": "Brief explanation of why this is VERIFIED FACT vs STRONG INFERENCE vs POSSIBLE INFERENCE vs UNKNOWN / NOT ESTABLISHED"
    }
  ],
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

Extract verified facts and classify claims with calibration levels in JSON:`;

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
        classifiedClaims: [],
        extractedFacts: newChunks.slice(0, 3).map(
          (c) =>
            `[${c.fileName || 'Document'}, ${c.isImage ? 'Image Evidence' : `Page ${c.pageNumber || 1}`}]: ${c.chunkText.slice(0, 150)}...`
        ),
        evidenceSummary: `Extracted facts from ${newChunks.length} evidence passages.`,
      };
    }

    return {
      round: currentRound,
      classifiedClaims: parsed.classifiedClaims || [],
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
      (c) => `[${c.fileName || 'Document'}, ${c.isImage ? 'Image Evidence' : `Page ${c.pageNumber || 1}`}]: ${c.chunkText.slice(0, 300)}`
    );
    return {
      round: currentRound,
      classifiedClaims: [],
      extractedFacts: fallbackFacts,
      summary: `Analyzed ${newChunks.length} chunk(s) directly from retrieved documents.`,
      analyzedChunksCount: newChunks.length,
    };
  }
};

export default { runEvidenceAgent };


