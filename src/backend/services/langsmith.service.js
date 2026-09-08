import dotenv from 'dotenv';
import { traceable, getCurrentRunTree } from 'langsmith/traceable';

dotenv.config();

/**
 * Centralized LangSmith Observability & Tracing Service for TraceMind
 *
 * Provides non-intrusive distributed tracing for:
 * 1. Root Trace: "TraceMind Investigation"
 * 2. Agent Executions: Planner, Retrieval, Vision, Evidence, Conflict, Sufficiency, Followup, Answer
 * 3. Retrieval Spans: Query Embedding, Qdrant Vector Search, Candidate Ranking
 * 4. LLM & Vision Inferences: Ollama qwen3:14b, qwen3-vl:8b, nomic-embed-text
 *
 * Fail-Safe & Non-Destructive Design:
 * - Traced functions ALWAYS return their authentic, unmodified outputs to application callers.
 * - Sanitization is applied exclusively to LangSmith trace payloads via process_outputs / process_inputs.
 * - Vectors, binary buffers, large raw texts, and secrets are never leaked to LangSmith.
 */

const SENSITIVE_KEYS_REGEX = /^(password|token|jwt|authorization|apiKey|api_key|secret|cookie|session)$/i;

/**
 * Check if LangSmith tracing is enabled and configured
 */
export const isLangSmithEnabled = () => {
  return (
    process.env.LANGSMITH_TRACING === 'true' &&
    Boolean(process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_API_KEY.trim())
  );
};

/**
 * Sanitize inputs/outputs before sending to LangSmith.
 * Prevents base64 image strings, binary buffers, full document texts, or secrets from being stored.
 */
export const sanitizeTracePayload = (val, depth = 0) => {
  if (depth > 5 || val === null || val === undefined) return val;

  if (typeof val === 'string') {
    // Exclude raw base64 images or long base64 chunks
    if (val.startsWith('data:image/') || (val.length > 250 && /^[A-Za-z0-9+/=]{100,}$/.test(val.slice(0, 100)))) {
      return `[BASE64_IMAGE_EXCLUDED length=${val.length}]`;
    }
    // Truncate excessively large strings
    if (val.length > 2000) {
      return val.slice(0, 2000) + '... [TRUNCATED]';
    }
    return val;
  }

  if (typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(val)) {
    return `[BINARY_BUFFER length=${val.length}]`;
  }

  if (Array.isArray(val)) {
    // If numeric dense vector (like 768-dim embeddings)
    if (val.length > 30 && typeof val[0] === 'number') {
      return {
        _type: 'embedding_vector',
        dimensions: val.length,
        sample: val.slice(0, 3),
      };
    }

    // If array of retrieval chunks, sanitize each to essential metadata + short excerpt
    if (val.length > 0 && val[0] && (val[0].chunkText !== undefined || val[0].pointId !== undefined || val[0].fileName !== undefined)) {
      return val.map((chunk) => ({
        fileName: chunk.fileName || 'unknown',
        documentId: chunk.documentId,
        pageNumber: chunk.pageNumber || 1,
        similarityScore: chunk.similarityScore,
        sourceType: chunk.sourceType || (chunk.isImage ? 'image' : 'document'),
        isImage: Boolean(chunk.isImage),
        hasExactMatch: Boolean(chunk.hasExactMatch),
        textExcerpt: chunk.chunkText ? chunk.chunkText.slice(0, 160) + (chunk.chunkText.length > 160 ? '...' : '') : undefined,
      }));
    }

    const maxItems = 20;
    const mapped = val.slice(0, maxItems).map((item) => sanitizeTracePayload(item, depth + 1));
    if (val.length > maxItems) {
      mapped.push(`... [${val.length - maxItems} additional items omitted]`);
    }
    return mapped;
  }

  if (typeof val === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(val)) {
      if (SENSITIVE_KEYS_REGEX.test(key)) {
        clean[key] = '[REDACTED]';
        continue;
      }
      if (key === 'buffer' || key === 'images' || key === 'rawChunks') {
        clean[key] = `[${key.toUpperCase()}_OMITTED]`;
        continue;
      }
      clean[key] = sanitizeTracePayload(value, depth + 1);
    }
    return clean;
  }

  return String(val);
};

/**
 * Root Trace: Wraps the entire investigation lifecycle under "TraceMind Investigation".
 * All child agents automatically nest within this root span via AsyncLocalStorage context.
 */
export const traceInvestigation = async (investigationFn, options = {}) => {
  if (!isLangSmithEnabled()) {
    return await investigationFn();
  }

  const {
    question = '',
    userId = 'anonymous',
    documentScope = 'all_documents',
    maxRounds = 4,
    topK = 8,
  } = options;

  const wrapped = traceable(
    async () => {
      const result = await investigationFn();
      
      // Update root trace run tree with final investigation summary
      const runTree = getCurrentRunTree();
      if (runTree) {
        runTree.extra = {
          ...runTree.extra,
          metadata: {
            ...runTree.extra?.metadata,
            totalRounds: result?.roundsCount || 1,
            totalEvidenceChunks: result?.totalEvidenceChunks || 0,
            confidence: result?.confidence,
            conflictDetected: Boolean(result?.conflictDetected),
            durationMs: result?.evaluationMetrics?.responseTimeMs,
          },
        };
      }

      // Return untouched result to caller
      return result;
    },
    {
      name: 'TraceMind Investigation',
      run_type: 'chain',
      project_name: process.env.LANGSMITH_PROJECT || 'TraceMind',
      process_outputs: (out) => sanitizeTracePayload(out),
      process_inputs: (inp) => sanitizeTracePayload(inp),
      metadata: {
        questionId: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId,
        documentScope,
        maxRoundsConfigured: maxRounds,
        topKConfigured: topK,
        framework: 'Google ADK + Ollama',
      },
      tags: ['tracemind', 'investigation', `scope:${documentScope}`],
    }
  );

  try {
    return await wrapped();
  } catch (err) {
    return await investigationFn();
  }
};

/**
 * Trace an individual agent execution as a child span
 *
 * @param {string} agentName - Readable trace name (e.g. "TraceMind - Planner Agent")
 * @param {Function} agentFn - Async function executing the agent
 * @param {Object} options - Metadata and run details
 */
export const traceAgent = async (agentName, agentFn, options = {}) => {
  if (!isLangSmithEnabled()) {
    return await agentFn();
  }

  const {
    round = 1,
    runType = 'chain',
    metadata = {},
    tags = [],
  } = options;

  const wrapped = traceable(
    async () => {
      const result = await agentFn();
      // Return untouched result to caller
      return result;
    },
    {
      name: agentName,
      run_type: runType,
      project_name: process.env.LANGSMITH_PROJECT || 'TraceMind',
      process_outputs: (out) => sanitizeTracePayload(out),
      process_inputs: (inp) => sanitizeTracePayload(inp),
      metadata: {
        agentName,
        round,
        ...metadata,
      },
      tags: ['agent', agentName.toLowerCase().replace(/[^a-z0-9]/g, '-'), ...tags],
    }
  );

  try {
    return await wrapped();
  } catch (err) {
    return await agentFn();
  }
};

/**
 * Trace retrieval sub-spans: "Query Embedding", "Qdrant Vector Search", "Candidate Ranking"
 */
export const traceRetrievalSpan = async (spanName, spanFn, metadata = {}) => {
  if (!isLangSmithEnabled()) {
    return await spanFn();
  }

  const wrapped = traceable(
    async () => {
      const result = await spanFn();
      // Return untouched result to caller (e.g. full 768-dim vector for Qdrant)
      return result;
    },
    {
      name: spanName,
      run_type: spanName.includes('Search') ? 'retriever' : 'tool',
      project_name: process.env.LANGSMITH_PROJECT || 'TraceMind',
      process_outputs: (out) => sanitizeTracePayload(out),
      process_inputs: (inp) => sanitizeTracePayload(inp),
      metadata: {
        spanName,
        ...metadata,
      },
      tags: ['retrieval', spanName.toLowerCase().replace(/\s+/g, '-')],
    }
  );

  try {
    return await wrapped();
  } catch (err) {
    return await spanFn();
  }
};

/**
 * Trace LLM inferences (Ollama qwen3:14b, qwen3-vl:8b)
 */
export const traceLlmCall = async ({ model, agent = 'generic', promptLength = 0 }, inferenceFn) => {
  if (!isLangSmithEnabled()) {
    return await inferenceFn();
  }

  const spanName = `Ollama - ${model}`;
  const t0 = Date.now();

  const wrapped = traceable(
    async () => {
      try {
        const result = await inferenceFn();
        const durationMs = Date.now() - t0;
        
        // Rough token estimation: ~4 chars per token
        const outputLength = typeof result === 'string' ? result.length : JSON.stringify(result || '').length;
        const estInputTokens = Math.round(promptLength / 4);
        const estOutputTokens = Math.round(outputLength / 4);

        const tree = getCurrentRunTree();
        if (tree) {
          tree.extra = {
            ...tree.extra,
            metadata: {
              ...tree.extra?.metadata,
              durationMs,
              model,
              agent,
              estInputTokens,
              estOutputTokens,
              success: true,
            },
          };
        }

        // Return untouched result to caller
        return result;
      } catch (err) {
        const tree = getCurrentRunTree();
        if (tree) {
          tree.extra = {
            ...tree.extra,
            metadata: {
              ...tree.extra?.metadata,
              durationMs: Date.now() - t0,
              model,
              agent,
              success: false,
              error: err.message,
            },
          };
        }
        throw err;
      }
    },
    {
      name: spanName,
      run_type: 'llm',
      project_name: process.env.LANGSMITH_PROJECT || 'TraceMind',
      process_outputs: (out) => sanitizeTracePayload(out),
      process_inputs: (inp) => sanitizeTracePayload(inp),
      metadata: {
        model,
        agent,
        provider: 'Ollama RunPod',
      },
      tags: ['llm', 'ollama', model.replace(/[^a-z0-9]/gi, '-')],
    }
  );

  try {
    return await wrapped();
  } catch (err) {
    return await inferenceFn();
  }
};

export default {
  isLangSmithEnabled,
  sanitizeTracePayload,
  traceInvestigation,
  traceAgent,
  traceRetrievalSpan,
  traceLlmCall,
};
