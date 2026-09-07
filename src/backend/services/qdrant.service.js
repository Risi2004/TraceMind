import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Qdrant Cloud Vector Database Service
 * Manages collections, vector embeddings, and chunk payload metadata in Qdrant Cloud.
 */

const getQdrantUrl = () => {
  return (process.env.QDRANT_URL || '').trim();
};

const getQdrantApiKey = () => {
  return (process.env.QDRANT_API_KEY || '').trim();
};

export const getQdrantCollectionName = () => {
  return (process.env.QDRANT_COLLECTION || 'tracemind_chunks').trim();
};

export const isQdrantConfigured = () => {
  const url = getQdrantUrl();
  const key = getQdrantApiKey();
  return Boolean(
    url &&
    key &&
    !url.includes('your-cluster-id') &&
    !url.includes('placeholder') &&
    !key.includes('your_qdrant_api_key')
  );
};

let qdrantClientInstance = null;

export const getQdrantClient = () => {
  if (!isQdrantConfigured()) {
    return null;
  }

  if (!qdrantClientInstance) {
    const url = getQdrantUrl();
    const apiKey = getQdrantApiKey();

    qdrantClientInstance = new QdrantClient({
      url,
      apiKey,
      timeout: 30000, // 30s timeout
    });

    console.log(`🔷 Qdrant Cloud Client initialized for cluster: ${url}`);
  }

  return qdrantClientInstance;
};

// In-memory fallback points store when Qdrant credentials are not yet populated during local testing
const localFallbackVectorStore = new Map();

/**
 * Ensure the Qdrant Cloud collection exists with Cosine distance and appropriate vector size
 * @param {number} vectorSize - Vector dimensionality (e.g. 768 for Nomic Embed Text)
 */
export const ensureCollectionExists = async (vectorSize = 768) => {
  const client = getQdrantClient();
  const collectionName = getQdrantCollectionName();

  if (!client) {
    console.warn(
      `⚠️ QDRANT_URL or QDRANT_API_KEY not configured. Running Qdrant in local fallback mode.`
    );
    return true;
  }

  try {
    const collectionsResponse = await client.getCollections();
    const exists = (collectionsResponse.collections || []).some(
      (col) => col.name === collectionName
    );

    if (!exists) {
      console.log(
        `🔷 [Qdrant] Collection "${collectionName}" does not exist. Creating with Cosine distance & size ${vectorSize}...`
      );

      await client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });

      console.log(`✅ [Qdrant] Collection "${collectionName}" created successfully.`);

      // Create payload indexes on userId and documentId for high-performance scoped filtering
      try {
        await client.createPayloadIndex(collectionName, {
          field_name: 'userId',
          field_schema: 'keyword',
          wait: true,
        });
        await client.createPayloadIndex(collectionName, {
          field_name: 'documentId',
          field_schema: 'keyword',
          wait: true,
        });
        console.log(`✅ [Qdrant] Payload indexes created for "userId" and "documentId".`);
      } catch (indexErr) {
        console.warn(`[Qdrant] Payload index notice: ${indexErr.message}`);
      }
    } else {
      // If collection exists, verify vector size matches
      try {
        const info = await client.getCollection(collectionName);
        const existingSize = info?.config?.params?.vectors?.size;
        if (existingSize && existingSize !== vectorSize) {
          console.log(
            `🔷 [Qdrant] Vector size mismatch (existing: ${existingSize}, model: ${vectorSize}). Recreating collection "${collectionName}" with size ${vectorSize}...`
          );
          await client.recreateCollection(collectionName, {
            vectors: {
              size: vectorSize,
              distance: 'Cosine',
            },
          });
          await client.createPayloadIndex(collectionName, {
            field_name: 'userId',
            field_schema: 'keyword',
            wait: true,
          });
          await client.createPayloadIndex(collectionName, {
            field_name: 'documentId',
            field_schema: 'keyword',
            wait: true,
          });
          console.log(`✅ [Qdrant] Collection "${collectionName}" updated to ${vectorSize} dimensions.`);
        }
      } catch (checkErr) {
        console.warn(`[Qdrant] Vector size verification notice: ${checkErr.message}`);
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ [Qdrant] Error checking/creating collection:`, error.message);
    throw new Error(`Failed to initialize Qdrant collection: ${error.message}`);
  }

};

/**
 * Store text chunks, embedding vectors, and payload metadata in Qdrant Cloud
 */
export const upsertDocumentChunks = async ({
  documentId,
  userId,
  fileName,
  archiveName = null,
  relativePath = null,
  chunks = [],
  vectors = [],
}) => {
  if (chunks.length === 0 || vectors.length === 0) {
    throw new Error('No chunks or vectors provided for Qdrant storage.');
  }

  const vectorSize = vectors[0]?.length || 768;
  const collectionName = getQdrantCollectionName();
  const client = getQdrantClient();

  // Format points with payload metadata
  const points = chunks.map((chunk, index) => ({
    id: uuidv4(),
    vector: vectors[index],
    payload: {
      documentId: String(documentId),
      userId: String(userId),
      fileName: String(fileName),
      archiveName: chunk.archiveName || archiveName || null,
      relativePath: chunk.relativePath || relativePath || null,
      sourceType: chunk.sourceType || 'document',
      isImage: Boolean(chunk.isImage),
      chunkNumber: (chunk.chunkIndex !== undefined ? chunk.chunkIndex : index) + 1,
      chunkIndex: chunk.chunkIndex !== undefined ? chunk.chunkIndex : index,
      pageNumber: chunk.pageNumber || 1,
      text: chunk.text,
      tokenCount: chunk.tokenCount || 0,
      charCount: chunk.charCount || chunk.text.length,
      totalChunks: chunk.totalChunks || chunks.length,
      createdAt: new Date().toISOString(),
      ...(chunk.metadata || {}),
    },
  }));

  if (client) {
    // Ensure collection exists with matching vector dimensionality
    await ensureCollectionExists(vectorSize);

    console.log(
      `🔷 [Qdrant] Upserting ${points.length} points into collection "${collectionName}"...`
    );

    await client.upsert(collectionName, {
      wait: true,
      points,
    });

    console.log(`✅ [Qdrant] Successfully stored ${points.length} chunks in Qdrant Cloud!`);
    return { success: true, count: points.length, storage: 'qdrant_cloud' };
  } else {
    // Local fallback store
    localFallbackVectorStore.set(String(documentId), points);
    console.log(
      `💾 [Qdrant Fallback] Stored ${points.length} chunks in local fallback store.`
    );
    return { success: true, count: points.length, storage: 'local_fallback' };
  }
};

/**
 * Delete all vector chunks associated with a document from Qdrant Cloud
 * @param {string} documentId - The document ID whose vectors should be removed
 */
export const deleteDocumentVectors = async (documentId) => {
  const client = getQdrantClient();
  const collectionName = getQdrantCollectionName();

  if (client) {
    try {
      console.log(`🔷 [Qdrant] Deleting points for documentId: "${documentId}"...`);
      await client.delete(collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: 'documentId',
              match: {
                value: String(documentId),
              },
            },
          ],
        },
      });
      console.log(`✅ [Qdrant] Deleted points for documentId: "${documentId}".`);
      return true;
    } catch (error) {
      console.error(`❌ [Qdrant] Delete error for doc ${documentId}:`, error.message);
      return false;
    }
  } else {
    localFallbackVectorStore.delete(String(documentId));
    return true;
  }
};

/**
 * Delete all vector chunks associated with a user or list of documents from Qdrant Cloud
 * @param {string} userId - The user ID whose vectors should be removed
 * @param {Array<string>} [documentIds] - Optional list of document IDs to clean up in local fallback
 */
export const deleteUserVectors = async (userId, documentIds = []) => {
  const client = getQdrantClient();
  const collectionName = getQdrantCollectionName();

  if (client) {
    try {
      console.log(`🔷 [Qdrant] Deleting all points for userId: "${userId}"...`);
      await client.delete(collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: 'userId',
              match: {
                value: String(userId),
              },
            },
          ],
        },
      });
      console.log(`✅ [Qdrant] Deleted all points for userId: "${userId}".`);
      return true;
    } catch (error) {
      console.error(`❌ [Qdrant] Delete error for userId ${userId}:`, error.message);
      return false;
    }
  } else {
    if (documentIds && documentIds.length > 0) {
      for (const id of documentIds) {
        localFallbackVectorStore.delete(String(id));
      }
    } else {
      localFallbackVectorStore.clear();
    }
    return true;
  }
};

/**
 * Search Qdrant Cloud for semantically similar chunks scoped by userId and optional documentId
 */
export const searchSimilarChunks = async ({
  userId,
  documentId,
  queryVector,
  limit = 5,
  scoreThreshold = 0.35,
}) => {
  const client = getQdrantClient();
  const collectionName = getQdrantCollectionName();

  // Local fallback search support
  const rawDocIds = Array.isArray(documentId)
    ? documentId.filter(id => id && id !== 'all').map(String)
    : typeof documentId === 'string' && documentId.trim() && documentId !== 'all'
    ? documentId.includes(',')
      ? documentId.split(',').map(s => s.trim()).filter(s => s && s !== 'all')
      : [documentId.trim()]
    : [];

  if (!client) {
    // Local fallback search
    const allFallbackPoints = [];
    for (const [docId, points] of localFallbackVectorStore.entries()) {
      if (rawDocIds.length === 0 || rawDocIds.includes(docId)) {
        allFallbackPoints.push(...points.filter(p => p.payload.userId === String(userId)));
      }
    }
    return allFallbackPoints.slice(0, limit).map((p, idx) => ({
      id: p.id,
      score: 0.95 - idx * 0.05,
      payload: p.payload,
    }));
  }

  const mustFilters = [
    {
      key: 'userId',
      match: {
        value: String(userId),
      },
    },
  ];

  if (rawDocIds.length === 1) {
    mustFilters.push({
      key: 'documentId',
      match: {
        value: rawDocIds[0],
      },
    });
  } else if (rawDocIds.length > 1) {
    mustFilters.push({
      key: 'documentId',
      match: {
        any: rawDocIds,
      },
    });
  }


  try {
    const queryParams = {
      query: queryVector,
      filter: {
        must: mustFilters,
      },
      limit,
      with_payload: true,
    };

    if (scoreThreshold !== undefined && scoreThreshold !== null) {
      queryParams.score_threshold = scoreThreshold;
    }

    const searchResponse = await client.query(collectionName, queryParams);
    return searchResponse.points || [];
  } catch (error) {
    console.error(`❌ [Qdrant] Search error:`, error.message);
    throw error;
  }


};

/**
 * Health check for Qdrant Cloud connection
 */
export const checkQdrantHealth = async () => {
  const client = getQdrantClient();
  if (!client) {
    return { ok: false, message: 'Qdrant credentials not configured in .env' };
  }

  try {
    const collections = await client.getCollections();
    return {
      ok: true,
      collections: (collections.collections || []).map((c) => c.name),
      url: getQdrantUrl(),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

export default {
  getQdrantClient,
  ensureCollectionExists,
  upsertDocumentChunks,
  deleteDocumentVectors,
  deleteUserVectors,
  searchSimilarChunks,
  checkQdrantHealth,
  isQdrantConfigured,
  getQdrantCollectionName,
};
