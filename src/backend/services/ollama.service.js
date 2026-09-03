import dotenv from 'dotenv';

dotenv.config();

/**
 * Ollama Embedding Client for RunPod Hosted Ollama Server
 * Communicates with remote Ollama instance running on RunPod.
 */

export const getOllamaBaseUrl = () => {
  const url = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  return url.replace(/\/+$/, '');
};

export const getOllamaEmbeddingModel = () => {
  return process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
};

export const isOllamaConfigured = () => {
  const url = getOllamaBaseUrl();
  return Boolean(
    url &&
    !url.includes('YOUR_RUNPOD_OLLAMA_URL') &&
    !url.includes('placeholder')
  );
};

/**
 * Check if the remote RunPod Ollama server is reachable
 */
export const checkOllamaHealth = async () => {
  const baseUrl = getOllamaBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const response = await fetch(`${baseUrl}/api/version`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return { ok: true, version: data.version, baseUrl };
    }
    return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      error: `RunPod Ollama instance unreachable at ${baseUrl}: ${err.message}`,
    };
  }
};

/**
 * Generate a dense vector embedding for a single text using RunPod Ollama
 * @param {string} text - Input text content to embed
 * @returns {Promise<number[]>} - Float vector embedding array
 */
export const generateEmbedding = async (text) => {
  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaEmbeddingModel();

  if (!isOllamaConfigured()) {
    console.warn(
      `⚠️ OLLAMA_BASE_URL is not configured with a valid RunPod URL. Using fallback deterministic embedding for testing.`
    );
    // Generate deterministic 384-dimensional normalized vector for development testing
    return generateFallbackEmbedding(text, 384);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for large chunks

  try {
    // Try Ollama /api/embeddings (standard endpoint)
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: text,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(
        `Ollama embedding error (HTTP ${response.status}): ${errBody || response.statusText}. Ensure model "${model}" is pulled on your RunPod pod (run: ollama pull ${model}).`
      );
    }

    const data = await response.json();

    if (data.embedding && Array.isArray(data.embedding)) {
      return data.embedding;
    }

    // Secondary format check (e.g. /api/embed response)
    if (data.embeddings && Array.isArray(data.embeddings[0])) {
      return data.embeddings[0];
    }

    throw new Error('Ollama response did not contain an embedding vector array.');
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`RunPod Ollama request timed out after 30s at ${baseUrl}`);
    }
    throw new Error(`RunPod Ollama embedding failed: ${err.message}`);
  }
};

/**
 * Generate embeddings for multiple text chunks in parallel batches
 * @param {Array<{ text: string }>} chunks - Array of chunk objects
 * @param {number} concurrency - Max simultaneous requests to RunPod
 * @returns {Promise<Array<number[]>>} - Array of embedding vectors
 */
export const generateBatchEmbeddings = async (chunks, concurrency = 4) => {
  const embeddings = new Array(chunks.length);
  let index = 0;

  const worker = async () => {
    while (index < chunks.length) {
      const currentIndex = index++;
      const chunk = chunks[currentIndex];
      const embedding = await generateEmbedding(chunk.text);
      embeddings[currentIndex] = embedding;
    }
  };

  const workers = [];
  const workerCount = Math.min(concurrency, chunks.length);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return embeddings;
};

/**
 * Deterministic fallback embedding generator for local testing when RunPod is offline
 */
const generateFallbackEmbedding = (text, dimensions = 384) => {
  const vector = new Array(dimensions).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  for (let i = 0; i < dimensions; i++) {
    vector[i] = Math.sin(hash + i * 0.1) * 0.5;
  }

  // Normalize vector to unit length
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vector.map((val) => val / norm);
};

export default {
  generateEmbedding,
  generateBatchEmbeddings,
  checkOllamaHealth,
  getOllamaBaseUrl,
  getOllamaEmbeddingModel,
  isOllamaConfigured,
};
