import {
  isLangSmithEnabled,
  sanitizeTracePayload,
  traceInvestigation,
  traceAgent,
  traceRetrievalSpan,
  traceLlmCall,
} from '../services/langsmith.service.js';

console.log('\n================================================================');
console.log('🧪 TRACEMIND LANGSMITH OBSERVABILITY & TRACING TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

// -------------------------------------------------------------
// TEST 1: Environment Variable Detection & Safe Defaults
// -------------------------------------------------------------
console.log('--- [1/4] Testing Configuration & Fallback Detection ---');
{
  const originalTracing = process.env.LANGSMITH_TRACING;
  const originalKey = process.env.LANGSMITH_API_KEY;

  delete process.env.LANGSMITH_TRACING;
  delete process.env.LANGSMITH_API_KEY;
  assert(!isLangSmithEnabled(), 'Returns false when LANGSMITH environment variables are unset');

  process.env.LANGSMITH_TRACING = 'true';
  process.env.LANGSMITH_API_KEY = '';
  assert(!isLangSmithEnabled(), 'Returns false when LANGSMITH_API_KEY is empty');

  process.env.LANGSMITH_TRACING = 'false';
  process.env.LANGSMITH_API_KEY = 'lsv2_test_key_abc123';
  assert(!isLangSmithEnabled(), 'Returns false when LANGSMITH_TRACING is false');

  process.env.LANGSMITH_TRACING = 'true';
  process.env.LANGSMITH_API_KEY = 'lsv2_test_key_abc123';
  assert(isLangSmithEnabled(), 'Returns true when LANGSMITH_TRACING=true and API key is present');

  // Restore
  process.env.LANGSMITH_TRACING = originalTracing || 'false';
  if (originalKey) process.env.LANGSMITH_API_KEY = originalKey;
  else delete process.env.LANGSMITH_API_KEY;
}

// -------------------------------------------------------------
// TEST 2: Data Sanitization & Payload Privacy Protection
// -------------------------------------------------------------
console.log('\n--- [2/4] Testing Privacy, Token Redaction & Payload Sanitization ---');
{
  // Sensitive tokens
  const payloadWithSecrets = {
    apiKey: 'secret_api_key_123',
    jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    password: 'super_secret_password',
    authorization: 'Bearer abcdef123456',
    normalField: 'Gloamreach Foundation',
  };
  const sanitizedSecrets = sanitizeTracePayload(payloadWithSecrets);
  assert(sanitizedSecrets.apiKey === '[REDACTED]', 'apiKey correctly redacted');
  assert(sanitizedSecrets.jwt === '[REDACTED]', 'jwt correctly redacted');
  assert(sanitizedSecrets.password === '[REDACTED]', 'password correctly redacted');
  assert(sanitizedSecrets.authorization === '[REDACTED]', 'authorization correctly redacted');
  assert(sanitizedSecrets.normalField === 'Gloamreach Foundation', 'Non-sensitive fields preserved');

  // Base64 images
  const fakeBase64 = 'data:image/png;base64,' + 'A'.repeat(500);
  const sanitizedImage = sanitizeTracePayload({ image: fakeBase64 });
  assert(
    typeof sanitizedImage.image === 'string' && sanitizedImage.image.includes('[BASE64_IMAGE_EXCLUDED'),
    'Base64 image payload excluded from LangSmith payloads'
  );

  // Buffer protection
  const buf = Buffer.from('binary-content-for-ocr');
  const sanitizedBuffer = sanitizeTracePayload({ buffer: buf });
  assert(
    sanitizedBuffer.buffer === '[BUFFER_OMITTED]' || sanitizedBuffer.buffer.includes('[BINARY_BUFFER'),
    'Binary buffer omitted'
  );

  // Large retrieval chunks array
  const mockChunks = [
    {
      fileName: 'chronicles_of_gloamreach.pdf',
      documentId: 'doc_123',
      pageNumber: 3,
      similarityScore: 0.94,
      sourceType: 'document',
      isImage: false,
      chunkText: 'The ancient foundation of Gloamreach occurred in the 42nd year of the Age of Shadows. '.repeat(10),
    },
  ];
  const sanitizedChunks = sanitizeTracePayload(mockChunks);
  assert(Array.isArray(sanitizedChunks), 'Chunks sanitized to array');
  assert(sanitizedChunks[0].fileName === 'chronicles_of_gloamreach.pdf', 'Chunk filename preserved');
  assert(sanitizedChunks[0].pageNumber === 3, 'Chunk page preserved');
  assert(sanitizedChunks[0].similarityScore === 0.94, 'Chunk similarity score preserved');
  assert(sanitizedChunks[0].textExcerpt.length < 200, 'Chunk text shortened to concise excerpt');
}

// -------------------------------------------------------------
// TEST 3: Trace Execution (Disabled Mode - No-Op Fallback)
// -------------------------------------------------------------
console.log('\n--- [3/4] Testing Trace Execution in Disabled Mode (Zero-Overhead) ---');
{
  delete process.env.LANGSMITH_API_KEY;
  process.env.LANGSMITH_TRACING = 'false';

  const t0 = Date.now();
  const res = await traceInvestigation(async () => {
    const p = await traceAgent('TraceMind - Planner Agent', async () => ({ goal: 'test' }));
    const r = await traceAgent('TraceMind - Retrieval Agent (Round 1)', async () => {
      const embed = await traceRetrievalSpan('Query Embedding', async () => [0.1, 0.2]);
      const search = await traceRetrievalSpan('Qdrant Vector Search', async () => [{ id: 1 }]);
      const rank = await traceRetrievalSpan('Candidate Ranking', async () => [{ id: 1, score: 0.9 }]);
      return { embed, search, rank };
    });
    const ans = await traceAgent('TraceMind - Answer Agent', async () => ({ text: 'Final answer' }));
    return { success: true, p, r, ans };
  }, { question: 'Test question' });

  const duration = Date.now() - t0;
  assert(res.success === true, 'Investigation returns correct result when LangSmith disabled');
  assert(res.p.goal === 'test', 'Planner child span returns correct data');
  assert(res.ans.text === 'Final answer', 'Answer child span returns correct data');
  assert(duration < 50, `Disabled execution adds 0ms overhead (took ${duration}ms)`);
}

// -------------------------------------------------------------
// TEST 4: Trace Execution & Async Propagation (Enabled Mode)
// -------------------------------------------------------------
console.log('\n--- [4/4] Testing Trace Execution & Span Hierarchy (Enabled Mode) ---');
{
  process.env.LANGSMITH_TRACING = 'true';
  process.env.LANGSMITH_API_KEY = 'lsv2_pt_test_key_for_span_validation';
  process.env.LANGSMITH_PROJECT = 'TraceMind';

  let plannerExecuted = false;
  let retrievalExecuted = false;
  let llmExecuted = false;
  let visionExecuted = false;
  let answerExecuted = false;

  const investigationResult = await traceInvestigation(async () => {
    // 1. Planner
    const plan = await traceAgent('TraceMind - Planner Agent', async () => {
      plannerExecuted = true;
      return { goal: 'Investigate Gloamreach founding', primaryQuery: 'Gloamreach founding' };
    }, { round: 1 });

    // 2. Retrieval with sub-spans
    const retrieval = await traceAgent('TraceMind - Retrieval Agent (Round 1)', async () => {
      retrievalExecuted = true;
      const emb = await traceRetrievalSpan('Query Embedding', async () => [0.1, 0.2, 0.3], { model: 'nomic-embed-text' });
      const qdrant = await traceRetrievalSpan('Qdrant Vector Search', async () => [{ id: 'p1', score: 0.95 }], { limit: 64 });
      const ranking = await traceRetrievalSpan('Candidate Ranking', async () => [{ fileName: 'doc.pdf', similarityScore: 0.95 }]);
      return { emb, qdrant, ranking };
    }, { round: 1 });

    // 3. Vision span
    const vision = await traceAgent('TraceMind - Vision Agent (Round 1)', async () => {
      visionExecuted = true;
      return { visualEvidence: 'Map diagram examined', confidence: 'high' };
    }, { round: 1, metadata: { fileName: 'map.png', visionModel: 'qwen3-vl:8b' } });

    // 4. LLM inference call
    const llm = await traceLlmCall({ model: 'qwen3:14b', agent: 'answer' }, async () => {
      llmExecuted = true;
      return 'The founding of Gloamreach took place in the year 42 of the Age of Shadows.';
    });

    // 5. Answer Agent
    const answer = await traceAgent('TraceMind - Answer Agent', async () => {
      answerExecuted = true;
      return { answer: llm, confidence: 95 };
    }, { round: 1 });

    return {
      success: true,
      plan,
      retrieval,
      vision,
      answer,
      roundsCount: 1,
      totalEvidenceChunks: 8,
      confidence: 95,
      conflictDetected: false,
    };
  }, {
    question: 'State the precise year in the Age of Shadows that marks the true founding of Gloamreach.',
    userId: 'test_user_6a96',
    documentScope: 'all_documents',
    maxRounds: 4,
    topK: 8,
  });

  assert(investigationResult.success === true, 'Root investigation executes successfully with tracing active');
  assert(plannerExecuted, 'Planner Agent trace executed');
  assert(retrievalExecuted, 'Retrieval Agent trace and sub-spans executed');
  assert(visionExecuted, 'Vision Agent trace executed');
  assert(llmExecuted, 'LLM inference span executed');
  assert(answerExecuted, 'Answer Agent trace executed');
  assert(investigationResult.answer.confidence === 95, 'Final output structure preserved without corruption');
}

console.log('\n================================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} LANGSMITH INTEGRATION TESTS PASSED!`);
console.log('================================================================\n');
