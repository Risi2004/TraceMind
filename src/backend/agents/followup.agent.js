import { getOllamaBaseUrl } from '../services/ollama.service.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';

/**
 * 5. Follow-up Search Agent (Google ADK Architecture)
 * Generates targeted alternative search queries to locate missing information,
 * physical maintenance records, forensic reviews, or timeline data in subsequent search rounds.
 */

export const runFollowUpSearchAgent = async ({
  question,
  missingInformation,
  previousQueries = [],
  currentRound = 1,
}) => {
  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaLlmModel();

  const systemPrompt = `You are the Follow-up Search Agent in TraceMind's iterative reasoning system.
Your job is to generate a new, highly targeted search query to retrieve the missing information identified by the Sufficiency Agent.

TARGETED SEARCH RULES:
1. If the missing detail involves physical status vs digital beacon/tag movement, target keywords like "maintenance", "log", "cart status", "battery", "storage", or "inspection".
2. If the missing detail involves credential use vs physical presence, target keywords like "packet replay", "forensic analysis", "network log", or "spoofing".
3. If the missing detail involves causality or timeline, target exact identifiers, equipment codes, or timestamps.
4. Do NOT repeat past queries: [${previousQueries.map((q) => `"${q}"`).join(', ')}].

Output strict JSON with format:
{
  "followUpQuery": "Concise search phrase to query Qdrant Cloud",
  "searchRationale": "1 short sentence explaining what this query is retrieving"
}`;

  const userPrompt = `Original Question: "${question}"
Missing Information Identified: "${missingInformation || 'Additional specific records or physical verification'}"

Generate the next targeted search query in JSON:`;

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
        options: { temperature: 0.2, num_predict: 256, num_ctx: 2048 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Follow-up Search LLM call failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.message?.content || data.response || '{}';

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = {
        followUpQuery: `${question} ${missingInformation || ''}`.trim(),
        searchRationale: `Follow-up search targeting ${missingInformation || 'missing facts'}`,
      };
    }

    let followUpQuery = (parsed.followUpQuery || '').trim();
    if (!followUpQuery || previousQueries.includes(followUpQuery)) {
      followUpQuery = `${missingInformation || question} physical forensic record`;
    }

    return {
      followUpQuery,
      searchRationale: parsed.searchRationale || `Targeting: ${missingInformation}`,
    };
  } catch (err) {
    console.warn(`[Follow-up Agent Notice]: ${err.message}`);
    return {
      followUpQuery: `${question} ${missingInformation || ''}`.trim(),
      searchRationale: 'Fallback query generation for missing information.',
    };
  }
};

export default { runFollowUpSearchAgent };

