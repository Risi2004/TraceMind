import { generateGroundedAnswer } from '../services/qwen.service.js';

/**
 * 6. Answer Synthesis Agent (Google ADK Architecture)
 * Synthesizes the final grounded response strictly from accumulated evidence chunks across all search rounds.
 */

export const runAnswerAgent = async ({
  question,
  accumulatedChunks = [],
  accumulatedFacts = [],
  classifiedClaims = [],
  conflictReport = null,
  chatHistory = [],
}) => {
  console.log(
    `✍️ [Answer Agent] Synthesizing final grounded response from ${accumulatedChunks.length} verified chunk(s) (${classifiedClaims.length} calibrated claim(s), Conflict: ${
      conflictReport && conflictReport.hasConflict ? 'DETECTED' : 'None'
    })...`
  );

  const finalAnswer = await generateGroundedAnswer({
    question,
    contextChunks: accumulatedChunks,
    classifiedClaims,
    conflictReport,
    chatHistory,
  });

  return {
    answer: finalAnswer,
    totalSourcesUsed: accumulatedChunks.length,
    conflictHandled: Boolean(conflictReport && conflictReport.hasConflict),
  };
};

export default { runAnswerAgent };

