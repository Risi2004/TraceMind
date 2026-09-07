import { callTextModel } from '../services/ollama.service.js';

/**
 * 1. Planner Agent (Google ADK Architecture)
 * Analyzes the user query and decomposes it into clear factual goals and an initial retrieval strategy.
 */

export const runPlannerAgent = async ({ question, scopeName = 'all documents' }) => {
  const systemPrompt = `You are the Lead Investigation Planner Agent in TraceMind's multi-hop reasoning system.
Your task is to analyze the user's question and determine the key factual targets and the optimal initial search query.

CRITICAL RULES:
- Output your response strictly as valid JSON with keys:
  "goal": "A single sentence describing the primary fact-gathering objective",
  "primaryQuery": "Clean topical keyword/semantic search query (do NOT include filenames, file extensions like .png, database IDs, or the target scope)",
  "entities": ["entity1", "entity2"] (key names, codes, dates, or item IDs mentioned in the question)
- Do NOT output any markdown ticks, conversational text, or explanation outside the JSON.`;

  const userPrompt = `User Question: "${question}"

Generate the JSON investigation plan:`;

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

