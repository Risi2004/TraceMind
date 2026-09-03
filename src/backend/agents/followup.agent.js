import { getOllamaBaseUrl } from '../services/ollama.service.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';

/**
 * 5. Follow-up Search Agent (Google ADK Architecture)
 * Generates targeted alternative search queries to locate missing information in subsequent search rounds.
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

CRITICAL RULES:
- Output strict JSON with format:
  "followUpQuery": "Specific keyword or semantic phrase to search Qdrant for missing facts",
  "searchRationale": "1 short sentence explaining what this follow-up query is targeting"
- Do NOT repeat past queries: [${previousQueries.map(q => `"${q}"`).join(', ')}]
- Focus directly on the missing information (e.g. synonyms, specific codes, table headers).
- Output valid JSON only with no conversational text.`;

  const userPrompt = `Original Question: "${question}"
Missing Information Identified: "${missingInformation || 'Additional specific details'}"

Generate the next targeted search query in JSON:`;

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
        options: { temperature: 0.2, num_ctx: 4096 },
      }),
    });

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
      followUpQuery = `${missingInformation || question} details`;
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
