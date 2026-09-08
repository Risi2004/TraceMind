import { callTextModel } from '../services/ollama.service.js';

/**
 * 3. Evidence Analysis Agent (Google ADK Architecture - High Performance)
 * Evaluates newly retrieved chunks, extracts verified factual claims, and classifies:
 * 1. VERIFIED FACT: directly visible in image or explicitly stated in text.
 * 2. STRONG INFERENCE: corroborated across sources, but not a single explicit statement.
 * 3. POSSIBLE INFERENCE: reasonable deduction or contextual association.
 * 4. UNKNOWN / NOT ESTABLISHED: insufficient or unspecified in evidence.
 */

export const runEvidenceAgent = async ({ question, newChunks = [], currentRound = 1 }) => {
  if (!newChunks || newChunks.length === 0) {
    return {
      round: currentRound,
      extractedFacts: [],
      classifiedClaims: [],
      hasDirectAnswer: false,
      directAnswerFact: null,
      summary: 'No new unique document chunks in this round.',
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

  const systemPrompt = `You are the Lead Evidence Analysis Agent in TraceMind.
Analyze retrieved document passages and extract verified factual statements.

FOUR EVIDENCE LEVELS:
1. VERIFIED FACT: Directly visible in image evidence or explicitly stated in document text.
2. STRONG INFERENCE: Supported independently by multiple consistent pieces of evidence, but not directly proven by a single explicit statement.
3. POSSIBLE INFERENCE: Reasonable deduction, plausible hypothesis, or contextual association (e.g. shared location, time, quantity, or similar names), but NOT proven.
4. UNKNOWN / NOT ESTABLISHED: The evidence is insufficient, silent, or unspecified regarding the claim.

RULES:
- Never convert an inference into a verified fact.
- No unsupported speculative words like "illegal", "criminal", "guilty" unless in source text.
- Preserve exact citations: [FileName, Page X].
- If a retrieved passage explicitly and unambiguously answers the user's specific question (e.g. precise date, year, location, serial number, or founder), set "hasDirectAnswer": true and "directAnswerFact": "<the exact verified statement with citation>".

OUTPUT STRICT CONCISE JSON:
{
  "hasDirectAnswer": true or false,
  "directAnswerFact": "Direct verified statement answering question (or null)",
  "claims": [
    {
      "claim": "Factual statement",
      "level": "VERIFIED FACT" | "STRONG INFERENCE" | "POSSIBLE INFERENCE" | "UNKNOWN / NOT ESTABLISHED",
      "source": "[FileName, Page X]"
    }
  ],
  "facts": [
    "Factual statement [FileName, Page X]"
  ]
}`;

  const userPrompt = `User Question: "${question}"

DOCUMENT PASSAGES:
${passagesText}

Extract verified facts and claims in strict JSON:`;

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
        hasDirectAnswer: false,
        directAnswerFact: null,
        claims: [],
        facts: newChunks.slice(0, 3).map(
          (c) => `[${c.fileName || 'Document'}, ${c.isImage ? 'Image Evidence' : `Page ${c.pageNumber || 1}`}]: ${c.chunkText.slice(0, 150)}...`
        ),
      };
    }

    const claims = Array.isArray(parsed.claims) ? parsed.claims : [];
    const facts = Array.isArray(parsed.facts) ? parsed.facts : [];

    // Fallback detection of direct verified answer
    let hasDirectAnswer = Boolean(parsed.hasDirectAnswer);
    let directAnswerFact = parsed.directAnswerFact || null;

    if (!hasDirectAnswer) {
      const verifiedClaim = claims.find((c) => c.level === 'VERIFIED FACT');
      if (verifiedClaim && (question.toLowerCase().includes('year') || question.toLowerCase().includes('who') || question.toLowerCase().includes('where') || question.toLowerCase().includes('when'))) {
        hasDirectAnswer = true;
        directAnswerFact = `${verifiedClaim.claim} (${verifiedClaim.source || 'Verified Source'})`;
      }
    }

    return {
      round: currentRound,
      classifiedClaims: claims,
      extractedFacts: facts,
      hasDirectAnswer,
      directAnswerFact,
      summary: `Analyzed ${newChunks.length} passage(s) (${claims.length} claim(s) calibrated).`,
      analyzedChunksCount: newChunks.length,
    };
  } catch (err) {
    console.warn(`[Evidence Agent Notice]: ${err.message}. Using direct chunk extraction.`);
    const fallbackFacts = (newChunks || []).slice(0, 4).map(
      (c) => `[${c.fileName || 'Document'}, ${c.isImage ? 'Image Evidence' : `Page ${c.pageNumber || 1}`}]: ${c.chunkText.slice(0, 250)}`
    );
    return {
      round: currentRound,
      classifiedClaims: [],
      extractedFacts: fallbackFacts,
      hasDirectAnswer: false,
      directAnswerFact: null,
      summary: `Extracted facts from ${newChunks.length} chunk(s).`,
      analyzedChunksCount: newChunks.length,
    };
  }
};

export default { runEvidenceAgent };
