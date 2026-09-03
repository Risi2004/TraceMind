import { runPlannerAgent } from './planner.agent.js';
import { runRetrievalAgent } from './retrieval.agent.js';
import { runEvidenceAgent } from './evidence.agent.js';
import { runConflictAgent } from './conflict.agent.js';
import { runSufficiencyAgent } from './sufficiency.agent.js';
import { runFollowUpSearchAgent } from './followup.agent.js';
import { runAnswerAgent } from './answer.agent.js';
import { getOllamaLlmModel } from '../services/qwen.service.js';
import adkLogger from '../services/adkLogger.service.js';

/**
 * Google ADK (Agent Development Kit) Master Orchestrator for TraceMind
 * Coordinates the multi-hop, iterative RAG search loop with structured evaluation telemetry:
 * 1. Planner Agent
 * 2. Retrieval Agent
 * 3. Evidence Agent
 * 4. Source Reliability & Conflict Agent
 * 5. Sufficiency Agent
 * 6. Follow-up Search Agent
 * 7. Answer Agent
 */

export const executeAdkInvestigation = async ({
  query,
  userId,
  documentId,
  chatHistory = [],
  maxRounds,
  topK,
}) => {
  const startTime = Date.now();
  const effectiveMaxRounds = maxRounds || parseInt(process.env.MAX_SEARCH_ROUNDS, 10) || 4;
  const effectiveTopK = topK || parseInt(process.env.RAG_TOP_K, 10) || 8;

  adkLogger.logInvestigationStart({
    question: query,
    userId,
    documentId,
    maxRounds: effectiveMaxRounds,
    topK: effectiveTopK,
  });

  const investigationSteps = [];
  const accumulatedChunks = [];
  const accumulatedFacts = [];
  const seenChunkIds = new Set();
  const previousQueries = [];

  let currentRound = 1;
  let sufficiencyStatus = { isSufficient: false, confidenceScore: 50, reason: '' };
  let conflictReport = { hasConflict: false, conflictType: 'none', conflictingSources: [], assessment: '', resolution: 'no_conflict' };
  let currentSearchQuery = query;

  // -------------------------------------------------------------
  // STEP 1: Planner Agent (Analyze & Deconstruct Goal)
  // -------------------------------------------------------------
  const plan = await runPlannerAgent({
    question: query,
    scopeName: documentId ? `Document (${documentId})` : 'All Documents',
  });

  currentSearchQuery = plan.primaryQuery || query;

  adkLogger.logPlannerResults({
    goal: plan.goal,
    primaryQuery: currentSearchQuery,
    entities: plan.entities,
  });

  investigationSteps.push({
    step: 1,
    title: 'Investigation Planning',
    icon: 'brain',
    status: 'completed',
    query: currentSearchQuery,
    details: plan.goal || `Decomposed query into targeted verification targets.`,
    found: plan.entities && plan.entities.length > 0 ? `Target Entities: ${plan.entities.join(', ')}` : undefined,
  });

  // -------------------------------------------------------------
  // ITERATIVE SEARCH LOOP (Rounds 1 to maxRounds)
  // -------------------------------------------------------------
  while (currentRound <= effectiveMaxRounds) {
    previousQueries.push(currentSearchQuery);

    // 2A. Retrieval Agent (Execute dense search in Qdrant)
    const retrievalResult = await runRetrievalAgent({
      searchQuery: currentSearchQuery,
      userId,
      documentId,
      seenChunkIds,
      topK: effectiveTopK,
    });

    if (retrievalResult.newChunks && retrievalResult.newChunks.length > 0) {
      accumulatedChunks.push(...retrievalResult.newChunks);
    }

    adkLogger.logRoundRetrieval({
      round: currentRound,
      query: currentSearchQuery,
      chunks: retrievalResult.newChunks,
      totalNew: retrievalResult.newChunks.length,
    });

    investigationSteps.push({
      step: investigationSteps.length + 1,
      title: `Document Vector Search (Round ${currentRound})`,
      icon: 'search',
      status: 'completed',
      query: currentSearchQuery,
      details: `Retrieved ${retrievalResult.newChunks.length} new unique evidence passage(s) from Qdrant Cloud.`,
      pagesCount: retrievalResult.newChunks.length,
    });

    // 2B. Evidence Agent (Extract facts & citations)
    const evidenceResult = await runEvidenceAgent({
      question: query,
      newChunks: retrievalResult.newChunks,
      currentRound,
    });

    if (evidenceResult.extractedFacts && evidenceResult.extractedFacts.length > 0) {
      accumulatedFacts.push(...evidenceResult.extractedFacts);
    }

    investigationSteps.push({
      step: investigationSteps.length + 1,
      title: `Evidence Analysis (Round ${currentRound})`,
      icon: 'layers',
      status: 'completed',
      details: evidenceResult.summary,
      found:
        evidenceResult.extractedFacts && evidenceResult.extractedFacts.length > 0
          ? evidenceResult.extractedFacts.slice(0, 2).join(' • ')
          : 'No additional facts discovered in this search round.',
    });

    // 2C. Source Reliability & Conflict Agent (Cross-examine sources)
    conflictReport = await runConflictAgent({
      question: query,
      accumulatedChunks,
      accumulatedFacts,
      currentRound,
    });

    adkLogger.logConflictEvaluation({
      round: currentRound,
      conflictReport,
    });

    if (conflictReport.hasConflict) {
      investigationSteps.push({
        step: investigationSteps.length + 1,
        title: 'Conflicting Sources Detected',
        icon: 'alert',
        status: 'completed',
        details: conflictReport.assessment,
        found:
          conflictReport.conflictingSources && conflictReport.conflictingSources.length > 0
            ? conflictReport.conflictingSources.map(s => `${s.document} (P.${s.page}): ${s.claim}`).join(' ⚡ ')
            : 'Contradiction across document sources noted.',
      });
    } else if (accumulatedChunks.length >= 2) {
      investigationSteps.push({
        step: investigationSteps.length + 1,
        title: 'Source Consistency Verified',
        icon: 'shield',
        status: 'completed',
        details: 'Cross-document consistency confirmed across all retrieved sources.',
      });
    }

    // 2D. Sufficiency Agent (Evaluate completeness & conflict resolution)
    sufficiencyStatus = await runSufficiencyAgent({
      question: query,
      accumulatedFacts,
      conflictReport,
      currentRound,
    });

    adkLogger.logSufficiencyEvaluation({
      round: currentRound,
      isSufficient: sufficiencyStatus.isSufficient,
      confidenceScore: sufficiencyStatus.confidenceScore,
      reason: sufficiencyStatus.reason,
      missingInformation: sufficiencyStatus.missingInformation,
    });

    if (sufficiencyStatus.isSufficient) {
      investigationSteps.push({
        step: investigationSteps.length + 1,
        title: 'Evidence Verified & Sufficient',
        icon: 'shield',
        status: 'completed',
        details: sufficiencyStatus.reason || 'All necessary factual points gathered with high confidence.',
      });
      break; // Exit loop early once sufficient evidence is gathered
    }

    // If evidence is not sufficient and we have search rounds remaining
    if (currentRound < effectiveMaxRounds) {
      investigationSteps.push({
        step: investigationSteps.length + 1,
        title: 'Missing Information Detected',
        icon: 'alert',
        status: 'completed',
        details: `Missing: ${sufficiencyStatus.missingInformation || 'Further details needed to answer completely.'}`,
      });

      // 2E. Follow-up Search Agent (Formulate next targeted query)
      const followUpResult = await runFollowUpSearchAgent({
        question: query,
        missingInformation: sufficiencyStatus.missingInformation,
        previousQueries,
        currentRound,
      });

      currentSearchQuery = followUpResult.followUpQuery;

      adkLogger.logFollowUpQuery({
        round: currentRound,
        followUpQuery: currentSearchQuery,
        searchRationale: followUpResult.searchRationale,
        missingInfo: sufficiencyStatus.missingInformation,
      });

      investigationSteps.push({
        step: investigationSteps.length + 1,
        title: `Executing Follow-up Search (Round ${currentRound + 1})`,
        icon: 'search',
        status: 'completed',
        query: currentSearchQuery,
        details: followUpResult.searchRationale || `Targeting: ${sufficiencyStatus.missingInformation}`,
      });

      currentRound++;
    } else {
      console.log(`⏹️ [ADK Loop] Max search rounds (${effectiveMaxRounds}) reached. Proceeding to answer synthesis.`);
      break;
    }
  }

  // -------------------------------------------------------------
  // STEP 3: Answer Agent (Grounded Synthesis + Conflict Citations)
  // -------------------------------------------------------------
  const answerResult = await runAnswerAgent({
    question: query,
    accumulatedChunks,
    accumulatedFacts,
    conflictReport,
    chatHistory,
  });

  const durationMs = Date.now() - startTime;

  investigationSteps.push({
    step: investigationSteps.length + 1,
    title: 'Grounded Answer Synthesis',
    icon: 'sparkles',
    status: 'completed',
    details: `Synthesized grounded answer backed by ${accumulatedChunks.length} verified passage(s) across ${currentRound} round(s)${
      conflictReport.hasConflict ? ' (including multi-source conflict disclosures)' : ''
    }.`,
  });

  // Format sources for citation rendering
  const sources = accumulatedChunks.map((chunk, idx) => ({
    fileName: chunk.fileName,
    pageNumber: chunk.pageNumber || 1,
    documentId: chunk.documentId,
    chunkNumber: chunk.chunkNumber || idx + 1,
    similarityScore: chunk.similarityScore,
    chunkExcerpt:
      chunk.chunkText && chunk.chunkText.length > 220
        ? `${chunk.chunkText.slice(0, 220)}...`
        : (chunk.chunkText || ''),
    fullText: chunk.chunkText,
    pointId: chunk.pointId,
  }));

  adkLogger.logInvestigationCompletion({
    totalRounds: currentRound,
    totalChunks: accumulatedChunks.length,
    finalSources: sources,
    durationMs,
    conflictDetected: Boolean(conflictReport && conflictReport.hasConflict),
    model: getOllamaLlmModel(),
  });

  return {
    success: true,
    answer: answerResult.answer,
    query,
    scope: documentId && documentId !== 'all' ? documentId : 'all_documents',
    roundsCount: currentRound,
    totalEvidenceChunks: accumulatedChunks.length,
    confidence: sufficiencyStatus.confidenceScore || 92,
    conflictDetected: Boolean(conflictReport && conflictReport.hasConflict),
    conflictReport: conflictReport.hasConflict ? conflictReport : undefined,
    sources,
    investigationSteps,
    evaluationMetrics: {
      responseTimeMs: durationMs,
      roundsCount: currentRound,
      maxRoundsConfigured: effectiveMaxRounds,
      topKConfigured: effectiveTopK,
      sourcesUsedCount: sources.length,
      conflictDetected: Boolean(conflictReport && conflictReport.hasConflict),
    },
    model: getOllamaLlmModel(),
    timestamp: new Date().toISOString(),
  };
};

export default {
  executeAdkInvestigation,
};


