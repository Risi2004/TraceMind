import { getOllamaBaseUrl } from '../services/ollama.service.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';

/**
 * 1. Planner Agent (Google ADK Architecture)
 * Analyzes the user query and decomposes it into clear factual goals and an initial retrieval strategy.
 */

export const runPlannerAgent = async ({ question, scopeName = 'all documents' }) => {
  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaLlmModel();

  const systemPrompt = `You are the Lead Investigation Planner Agent in TraceMind's multi-hop reasoning system.
Your task is to analyze the user's question and determine the key factual targets and the optimal initial search query.

CRITICAL RULES:
- Output your response strictly as valid JSON with keys:
  "goal": "A single sentence describing the primary fact-gathering objective",
  "primaryQuery": "The most effective keyword/semantic search query to find this information in documents",
  "entities": ["entity1", "entity2"] (key names, codes, dates, or IDs mentioned)
- Do NOT output any markdown ticks, conversational text, or explanation outside the JSON.`;

  const userPrompt = `Target Scope: ${scopeName}
User Question: "${question}"

Generate the JSON investigation plan:`;

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
        options: { temperature: 0.1, num_predict: 256, num_ctx: 2048 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);


    if (!response.ok) {
      throw new Error(`Planner LLM call failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.message?.content || data.response || '{}';

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = {
        goal: `Verify information regarding "${question}"`,
        primaryQuery: question,
        entities: [],
      };
    }

    return {
      goal: parsed.goal || `Investigate "${question}"`,
      primaryQuery: parsed.primaryQuery || question,
      entities: parsed.entities || [],
    };
  } catch (err) {
    console.warn(`[Planner Agent Notice]: ${err.message}. Using direct query.`);
    return {
      goal: `Search documents for "${question}"`,
      primaryQuery: question,
      entities: [],
    };
  }
};

export default { runPlannerAgent };
