import dotenv from 'dotenv';

dotenv.config();

/**
 * ADK Structured Logger & Evaluation Telemetry Service
 * Produces structured diagnostic logs for evaluation and reliability debugging
 * without exposing raw internal chain-of-thought.
 */

const isDebugEnabled = () => {
  return process.env.ENABLE_ADK_DEBUG_LOGS !== 'false';
};

export const logInvestigationStart = ({
  question,
  userId,
  documentId,
  maxRounds,
  topK,
}) => {
  if (!isDebugEnabled()) return;
  console.log(`\n╔══════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║ 🚀 [ADK-START] NEW AGENTIC INVESTIGATION SESSION                          ║`);
  console.log(`╠══════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ ❓ User Question   : "${question}"`);
  console.log(`║ 👤 User ID         : ${userId}`);
  console.log(`║ 📁 Document Scope  : ${documentId || 'all_documents'}`);
  console.log(`║ ⚙️ Max Rounds      : ${maxRounds} | Top-K: ${topK}`);
  console.log(`╚══════════════════════════════════════════════════════════════════════════╝`);
};

export const logPlannerResults = ({ goal, primaryQuery, entities = [] }) => {
  if (!isDebugEnabled()) return;
  console.log(`\n🧠 [ADK-PLANNER] Search Strategy Formulated:`);
  console.log(`   🎯 Goal          : ${goal}`);
  console.log(`   🔍 Primary Query : "${primaryQuery}"`);
  if (entities.length > 0) {
    console.log(`   🏷️ Target Entities: [${entities.join(', ')}]`);
  }
};

export const logRoundRetrieval = ({ round, query, chunks = [], totalNew = 0 }) => {
  if (!isDebugEnabled()) return;
  console.log(`\n🔎 [ADK-RETRIEVAL] Search Round #${round}:`);
  console.log(`   🎯 Vector Query  : "${query}"`);
  console.log(`   📦 Retrieved     : ${chunks.length} total chunk(s) (${totalNew} new unique)`);
  if (chunks.length > 0) {
    console.log(`   📄 Document Sources:`);
    chunks.forEach((c, idx) => {
      const score = c.similarityScore ? (c.similarityScore * 100).toFixed(1) + '%' : 'N/A';
      console.log(`      [${idx + 1}] "${c.fileName}" | Page ${c.pageNumber || 1} | SimScore: ${score}`);
    });
  } else {
    console.log(`   ⚠️ No matching vectors found in Qdrant for this query.`);
  }
};

export const logConflictEvaluation = ({ round, conflictReport }) => {
  if (!isDebugEnabled()) return;
  if (!conflictReport) return;
  console.log(`\n⚖️ [ADK-CONFLICT] Cross-Document Analysis (Round #${round}):`);
  console.log(`   ⚡ Has Conflict  : ${conflictReport.hasConflict ? 'YES (Discrepancy Detected)' : 'NO (Consistent)'}`);
  if (conflictReport.hasConflict) {
    console.log(`   🏷️ Conflict Type : ${conflictReport.conflictType}`);
    console.log(`   📝 Assessment    : ${conflictReport.assessment}`);
    if (conflictReport.conflictingSources && conflictReport.conflictingSources.length > 0) {
      conflictReport.conflictingSources.forEach((s, idx) => {
        console.log(`      Source ${idx + 1}: ${s.document} (P.${s.page}) => "${s.claim}" [${s.reliability || 'Standard'}]`);
      });
    }
  } else {
    console.log(`   ✅ Status        : Evidence is consistent across sources.`);
  }
};

export const logSufficiencyEvaluation = ({
  round,
  isSufficient,
  confidenceScore,
  reason,
  missingInformation,
}) => {
  if (!isDebugEnabled()) return;
  console.log(`\n📊 [ADK-SUFFICIENCY] Evaluation Result (Round #${round}):`);
  console.log(`   Status         : ${isSufficient ? '✅ SUFFICIENT (Proceed to Answer)' : '⚠️ INSUFFICIENT (Another Round Needed)'}`);
  console.log(`   Confidence     : ${confidenceScore}%`);
  console.log(`   Reason         : ${reason}`);
  if (!isSufficient && missingInformation) {
    console.log(`   🔍 Trigger Reason: Missing facts => "${missingInformation}"`);
  }
};

export const logFollowUpQuery = ({ round, followUpQuery, searchRationale, missingInfo }) => {
  if (!isDebugEnabled()) return;
  console.log(`\n🔄 [ADK-FOLLOWUP] Triggering Iterative Search Round #${round + 1}:`);
  console.log(`   🎯 Targeted Query: "${followUpQuery}"`);
  console.log(`   💡 Search Rationale: ${searchRationale}`);
  console.log(`   🎯 Missing Target: "${missingInfo}"`);
};

export const logInvestigationCompletion = ({
  totalRounds,
  totalChunks,
  finalSources = [],
  durationMs,
  conflictDetected,
  model,
}) => {
  if (!isDebugEnabled()) return;
  console.log(`\n╔══════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║ 🎉 [ADK-COMPLETE] INVESTIGATION SUMMARY & EVALUATION METRICS            ║`);
  console.log(`╠══════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ 🔄 Total Search Rounds   : ${totalRounds}`);
  console.log(`║ 📚 Verified Evidence Chunks: ${totalChunks}`);
  console.log(`║ 📄 Unique Sources Cited  : ${finalSources.length}`);
  console.log(`║ ⚡ Source Conflict Present: ${conflictDetected ? 'YES' : 'NO'}`);
  console.log(`║ ⏱️ Total Response Time   : ${durationMs}ms`);
  console.log(`║ 🤖 LLM Model             : ${model}`);
  console.log(`╚══════════════════════════════════════════════════════════════════════════╝\n`);
};

export default {
  logInvestigationStart,
  logPlannerResults,
  logRoundRetrieval,
  logConflictEvaluation,
  logSufficiencyEvaluation,
  logFollowUpQuery,
  logInvestigationCompletion,
};
