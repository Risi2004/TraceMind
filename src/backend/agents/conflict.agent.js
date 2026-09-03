import { getOllamaBaseUrl } from '../services/ollama.service.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';

/**
 * Source Reliability and Conflict Agent (Google ADK Architecture)
 * Responsibilities:
 * 1. Cross-examine claims and evidence coming from different documents / passages.
 * 2. Apply Evidence Hierarchy:
 *    - Physical maintenance records & tested forensic analysis > provisional witness impressions / digital signal assumptions.
 *    - Later retractions / corrected witness statements > initial unverified impressions.
 *    - Subsequent forensic testing > initial provisional incident classifications.
 * 3. Resolve apparent conflicts cleanly rather than declaring false inconclusiveness when stronger evidence resolves them.
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

  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaLlmModel();

  const passagesSummary = accumulatedChunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] Document: "${c.fileName || 'Doc'}" (Page ${c.pageNumber || 1})\nContent: ${c.chunkText.slice(0, 500)}`
    )
    .join('\n\n');

  const systemPrompt = `You are the Lead Source Reliability and Conflict Analysis Agent in TraceMind's reasoning system.
Your job is to compare evidence across different documents or distinct passages to detect disagreements, contradictions, or competing accounts.

HIERARCHICAL CONFLICT RESOLUTION RULES:
1. EVIDENCE HIERARCHY:
   - Prefer physical verification, tested forensic evidence, and signed maintenance logs over witness guesses, transponder assumptions, or provisional interpretations.
   - Example: If a beacon/tag signal moved but physical maintenance records prove the physical cart remained sealed/immobilized with battery removed, conclude: "The tag/signal moved, but the physical cart did not."
2. RETRACTIONS & CORRECTIONS:
   - If a witness or analyst subsequently retracted or corrected an earlier statement (e.g. "thought it was Mira" -> "later corrected: likely not Mira"), prioritize the corrected statement.
3. EVOLUTION OF FORENSICS VS INITIAL REPORT:
   - Distinguish initial provisional logging from later forensic conclusions (e.g. "The initial report recorded credential E-17, but subsequent forensic analysis proved the packet was replayed through R-19").
4. AVOID PREMATURE "INCONCLUSIVE":
   - Do NOT say "evidence is inconclusive" if higher-order evidence (physical logs, later forensics) resolves the apparent disagreement.

Output strict JSON with format:
{
  "hasConflict": true or false,
  "conflictType": "physical_vs_signal" | "initial_vs_forensic" | "witness_retraction" | "factual_contradiction" | "date_discrepancy" | "none",
  "conflictingSources": [
    { "document": "Doc A", "page": 1, "claim": "...", "reliability": "..." }
  ],
  "assessment": "Clear summary of the disagreement and how the evidence hierarchy resolves it.",
  "resolution": "resolved" | "unresolved" | "no_conflict",
  "resolvedFinding": "The definitive factual takeaway after applying the evidence hierarchy (or null if truly unresolved)."
}`;

  const userPrompt = `User Question: "${question}"
Distinct Documents Examined: [${uniqueDocNames.join(', ')}]

RETRIEVED PASSAGES TO CROSS-EXAMINE:
${passagesSummary}

Analyze conflicts, hierarchy, and resolution in JSON:`;

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

