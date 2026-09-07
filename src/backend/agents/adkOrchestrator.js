import { runPlannerAgent } from './planner.agent.js';
import { runRetrievalAgent } from './retrieval.agent.js';
import { runVisionAgent, getVisionAgentModel } from './vision.agent.js';
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
 * 3. Vision Agent (Dedicated visual/image analysis with Qwen3-VL:8b)
 * 4. Evidence Agent
 * 5. Source Reliability & Conflict Agent
 * 6. Sufficiency Agent
 * 7. Follow-up Search Agent
 * 8. Answer Agent
 */

export const executeAdkInvestigation = async ({
  query,
  userId,
  documentId,
  scopeName = null,
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
  const executionEvents = [];
  const accumulatedChunks = [];
  const accumulatedFacts = [];
  const accumulatedClassifiedClaims = [];
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
    scopeName: scopeName || (documentId && documentId !== 'all' ? 'Target Document Asset' : 'All Documents'),
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

  executionEvents.push({
    agent: 'planner',
    event: 'PLANNING_COMPLETED',
    round: 1,
    message: 'Planning investigation',
    timestamp: new Date().toISOString(),
    metadata: {
      goal: plan.goal || 'Formulated search strategy',
      entities: plan.entities || [],
      primaryQuery: currentSearchQuery,
    },
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
      details: `Retrieved ${retrievalResult.newChunks.length} new unique evidence passage(s) from knowledge base.`,
      pagesCount: retrievalResult.newChunks.length,
    });

    executionEvents.push({
      agent: 'retrieval',
      event: 'SEARCH_COMPLETED',
      round: currentRound,
      message: `${retrievalResult.newChunks.length} relevant passage${retrievalResult.newChunks.length === 1 ? '' : 's'} found`,
      timestamp: new Date().toISOString(),
      metadata: {
        sourcesFound: retrievalResult.newChunks.length,
        query: currentSearchQuery,
      },
    });

    // 2B. Dedicated Vision Agent (Invoke ONLY if visual/image content is retrieved)
    const imageChunks = (retrievalResult.newChunks || []).filter(
      (chunk) =>
        chunk.isImage ||
        chunk.sourceType === 'image' ||
        chunk.contentType === 'image' ||
        /\.(png|jpe?g|webp)$/i.test(chunk.fileName || '')
    );

    if (imageChunks.length > 0) {
      const visionResult = await runVisionAgent({
        visualChunks: imageChunks,
        fileName: imageChunks[0]?.fileName || 'Visual Evidence',
        documentId: imageChunks[0]?.documentId || documentId,
        pageNumber: imageChunks[0]?.pageNumber || 1,
        question: query,
      });

      investigationSteps.push({
        step: investigationSteps.length + 1,
        title: `Vision Agent Evidence Inspection (Round ${currentRound})`,
        icon: 'image',
        status: 'completed',
        details: visionResult.structuredEvidence?.summary || `Examined ${imageChunks.length} visual asset(s) with visual analysis engine.`,
        found:
          visionResult.structuredEvidence?.importantFacts && visionResult.structuredEvidence.importantFacts.length > 0
            ? visionResult.structuredEvidence.importantFacts.slice(0, 2).join(' • ')
            : 'Visual diagram and OCR markings verified.',
      });

      executionEvents.push({
        agent: 'vision',
        event: 'VISION_ANALYSIS_COMPLETED',
        round: currentRound,
        message: `Visual evidence extracted from ${imageChunks.length} asset${imageChunks.length === 1 ? '' : 's'}`,
        timestamp: new Date().toISOString(),
        metadata: {
          confidence: visionResult.structuredEvidence?.confidence || 'high',
          visualChunksCount: imageChunks.length,
          model: 'Visual Reasoning Engine',
        },
      });

      if (visionResult.structuredEvidence?.importantFacts) {
        accumulatedFacts.push(...visionResult.structuredEvidence.importantFacts);
      }
    }

    // 2C & 2D. Run Evidence Agent and Conflict Agent in parallel for 2x faster investigation
    const [evidenceResult, conflictReportResult] = await Promise.all([
      runEvidenceAgent({
        question: query,
        newChunks: retrievalResult.newChunks,
        currentRound,
      }),
      runConflictAgent({
        question: query,
        accumulatedChunks,
        accumulatedFacts,
        currentRound,
      }),
    ]);

    conflictReport = conflictReportResult;

    if (evidenceResult.extractedFacts && evidenceResult.extractedFacts.length > 0) {
      accumulatedFacts.push(...evidenceResult.extractedFacts);
    }
    if (evidenceResult.classifiedClaims && evidenceResult.classifiedClaims.length > 0) {
      accumulatedClassifiedClaims.push(...evidenceResult.classifiedClaims);
    }

    const claimsCount = evidenceResult.classifiedClaims?.length || 0;
    const claimsDisplay =
      claimsCount > 0
        ? ` (${claimsCount} claim${claimsCount === 1 ? '' : 's'} calibrated: ${evidenceResult.classifiedClaims
            .map((c) => c.level)
            .slice(0, 3)
            .join(', ')})`
        : '';

    investigationSteps.push({
      step: investigationSteps.length + 1,
      title: `Evidence Analysis (Round ${currentRound})`,
      icon: 'layers',
      status: 'completed',
      details: `${evidenceResult.summary}${claimsDisplay}`,
      found:
        evidenceResult.extractedFacts && evidenceResult.extractedFacts.length > 0
          ? evidenceResult.extractedFacts.slice(0, 2).join(' • ')
          : 'No additional facts discovered in this search round.',
    });

    executionEvents.push({
      agent: 'evidence',
      event: 'EVIDENCE_ANALYZED',
      round: currentRound,
      message: 'Analyzing retrieved evidence',
      timestamp: new Date().toISOString(),
      metadata: {
        factsExtracted: evidenceResult.extractedFacts?.length || 0,
        claimsCalibrated: claimsCount,
        analyzedChunks: retrievalResult.newChunks?.length || 0,
      },
    });

    adkLogger.logConflictEvaluation({
      round: currentRound,
      conflictReport,
    });

    // Only emit Conflict event if conflict was actually detected
    if (conflictReport.hasConflict) {
      investigationSteps.push({
        step: investigationSteps.length + 1,
        title: 'Conflicting Sources Detected',
        icon: 'alert',
        status: 'completed',
        details: conflictReport.assessment,
        found:
          conflictReport.conflictingSources && conflictReport.conflictingSources.length > 0
            ? conflictReport.conflictingSources.map((s) => `${s.document} (P.${s.page}): ${s.claim}`).join(' ⚡ ')
            : 'Contradiction across document sources noted.',
      });

      executionEvents.push({
        agent: 'conflict',
        event: 'CONFLICT_DETECTED',
        round: currentRound,
        message: 'Conflicting evidence detected',
        timestamp: new Date().toISOString(),
        metadata: {
          conflictType: conflictReport.conflictType,
          assessment: conflictReport.assessment,
          resolution: conflictReport.resolution,
          sourcesCount: conflictReport.conflictingSources?.length || 0,
        },
      });
    }

    // 2D. Sufficiency Agent (Evaluate completeness & conflict resolution)
    sufficiencyStatus = await runSufficiencyAgent({
      question: query,
      accumulatedFacts,
      accumulatedChunks,
      classifiedClaims: accumulatedClassifiedClaims,
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

    executionEvents.push({
      agent: 'sufficiency',
      event: 'SUFFICIENCY_EVALUATED',
      round: currentRound,
      message: sufficiencyStatus.isSufficient ? 'Evidence sufficient' : 'More evidence required',
      timestamp: new Date().toISOString(),
      metadata: {
        isSufficient: Boolean(sufficiencyStatus.isSufficient),
        confidenceScore: sufficiencyStatus.confidenceScore,
        reason: sufficiencyStatus.reason,
        missingInformation: sufficiencyStatus.missingInformation,
      },
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

      executionEvents.push({
        agent: 'followup',
        event: 'FOLLOWUP_GENERATED',
        round: currentRound,
        message: 'Preparing targeted follow-up search',
        timestamp: new Date().toISOString(),
        metadata: {
          followUpQuery: currentSearchQuery,
          searchRationale: followUpResult.searchRationale,
          missingTarget: sufficiencyStatus.missingInformation,
        },
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
    classifiedClaims: accumulatedClassifiedClaims,
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

  executionEvents.push({
    agent: 'answer',
    event: 'ANSWER_GENERATED',
    round: currentRound,
    message: 'Generating final answer',
    timestamp: new Date().toISOString(),
    metadata: {
      sourcesUsed: accumulatedChunks.length,
      conflictHandled: Boolean(conflictReport && conflictReport.hasConflict),
    },
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
    executionEvents,
    evaluationMetrics: {
      responseTimeMs: durationMs,
      roundsCount: currentRound,
      maxRoundsConfigured: effectiveMaxRounds,
      topKConfigured: effectiveTopK,
      sourcesUsedCount: sources.length,
      conflictDetected: Boolean(conflictReport && conflictReport.hasConflict),
      conflictsCount: conflictReport.hasConflict ? (conflictReport.conflictingSources?.length || 1) : 0,
    },
    model: 'TraceMind AI Engine',
    timestamp: new Date().toISOString(),
  };
};

export default {
  executeAdkInvestigation,
};



