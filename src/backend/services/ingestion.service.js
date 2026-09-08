import Document from '../models/Document.js';
import { extractDocumentText } from './extractor.service.js';
import { createDocumentChunks } from './chunking.service.js';
import { generateBatchEmbeddings } from './ollama.service.js';
import { upsertDocumentChunks, deleteDocumentVectors } from './qdrant.service.js';
import { deleteFileFromR2 } from './r2.service.js';

/**
 * RAG Ingestion Pipeline Service
 * Orchestrates text extraction -> semantic chunking -> RunPod Ollama Nomic embeddings -> Qdrant Cloud storage
 * Keeps MongoDB ONLY for document metadata and processing status tracking.
 * Automatically deletes the file from Cloudflare R2 if vectorization/processing fails.
 */

export const processDocumentForRag = async ({
  documentId,
  userId,
  buffer,
  filename,
  originalName = null,
  fileType,
  mimeType,
  parentZipName = null,
  relativePath = null,
}) => {
  const isImageFile =
    fileType === 'IMAGE' ||
    (mimeType && mimeType.startsWith('image/')) ||
    /\.(png|jpg|jpeg|webp)$/i.test(filename);

  console.log(`\n[RAG Pipeline] Processing ${isImageFile ? 'image' : 'document'}: "${filename}" (ID: ${documentId})${parentZipName ? ` [Archive: ${parentZipName} | Path: ${relativePath}]` : ''}`);

  try {
    // 1. Mark status as 'processing' or 'analyzing' in MongoDB
    await Document.findByIdAndUpdate(documentId, {
      status: isImageFile ? 'analyzing' : 'processing',
      errorMessage: null,
    });

    // 2. Extract text/vision evidence from document or image buffer
    // NOTE: Images are routed DIRECTLY to extractFromImage -> Vision Agent (Qwen3-VL)
    // without any text-only pre-extraction step.
    console.log(`[RAG Pipeline] ${isImageFile ? 'Analyzing image with Qwen3-VL Vision Agent' : 'Extracting text'} for: "${filename}"...`);
    const tExtract0 = Date.now();
    const extractionResult = await extractDocumentText({
      buffer,
      filename,
      fileType,
      mimeType,
      documentId,
    });
    const extractionMs = Date.now() - tExtract0;

    if (!extractionResult.fullText || !extractionResult.fullText.trim()) {
      throw new Error(
        isImageFile
          ? 'Vision analysis produced no extractable evidence from image.'
          : 'Document appears empty or contains no extractable text.'
      );
    }

    console.log(
      `[RAG Pipeline] Extracted ${extractionResult.fullText.length} characters across ${extractionResult.totalPages} page/image unit(s).`
    );

    // 3. Create semantic chunks (~1000 tokens, 10-15% overlap)
    console.log(`[RAG Pipeline] Chunking content with 10-15% overlap...`);
    const tChunk0 = Date.now();
    const rawChunks = createDocumentChunks({
      pages: extractionResult.pages,
      fullText: extractionResult.fullText,
      documentId,
      userId,
      fileName: filename,
      originalName: originalName || filename,
      archiveName: parentZipName,
      relativePath: relativePath,
      targetTokens: 1000,
      overlapPercent: 0.12, // 12%
    });

    if (rawChunks.length === 0) {
      throw new Error('No valid text chunks could be generated.');
    }

    const chunkingMs = Date.now() - tChunk0;
    console.log(
      `[RAG Pipeline] Generated ${rawChunks.length} RAG chunk(s). Generating Nomic embeddings on RunPod Ollama...`
    );

    // Update status to 'processing' before embeddings
    await Document.findByIdAndUpdate(documentId, {
      status: 'processing',
    });

    // 4. Generate embeddings via RunPod Ollama (Nomic Embed Text) in parallel batches
    const tEmbed0 = Date.now();
    const embeddings = await generateBatchEmbeddings(rawChunks, 4);
    const embeddingMs = Date.now() - tEmbed0;

    // 5. Store chunk text, embedding vectors, and metadata in Qdrant Cloud (NOT MongoDB)
    console.log(`[RAG Pipeline] Uploading vector chunks to Qdrant Cloud...`);
    const tQdrant0 = Date.now();
    const qdrantResult = await upsertDocumentChunks({
      documentId,
      userId,
      fileName: filename,
      archiveName: parentZipName,
      relativePath: relativePath,
      chunks: rawChunks,
      vectors: embeddings,
    });

    const qdrantMs = Date.now() - tQdrant0;
    const tMongo0 = Date.now();
    // 6. Only mark document 'ready' in MongoDB after all chunks are successfully stored in Qdrant
    await Document.findByIdAndUpdate(documentId, {
      status: 'ready',
      metadata: {
        chunksCount: rawChunks.length,
        totalPages: extractionResult.totalPages,
        isImage: isImageFile,
        sourceType: isImageFile ? 'image' : 'document',
        visionModel: extractionResult.model || null,
        vectorStorage: qdrantResult.storage || 'qdrant_cloud',
        archiveName: parentZipName || null,
        relativePath: relativePath || filename,
        extractedEvidence: extractionResult.structuredEvidence || null,
        processedAt: new Date(),
      },
    });
    const mongoMs = Date.now() - tMongo0;

    console.log(
      `[RAG Pipeline] ${isImageFile ? 'Image' : 'Document'} "${filename}" is READY in Qdrant Cloud for RAG retrieval!\n`
    );

    return {
      success: true,
      documentId,
      chunksCount: rawChunks.length,
      totalPages: extractionResult.totalPages,
      isImage: isImageFile,
      archiveName: parentZipName,
      relativePath,
      storage: qdrantResult.storage,
      timings: {
        extractionMs,
        chunkingMs,
        embeddingMs,
        qdrantMs,
        mongoMs,
        isImage: isImageFile,
        chunksCount: rawChunks.length,
      },
    };
  } catch (error) {
    console.error(
      `[RAG Pipeline] Processing failed for "${filename}":`,
      error.message
    );

    // Clean up: Delete stored file from Cloudflare R2 on vectorization failure
    try {
      const failedDoc = await Document.findById(documentId);
      if (failedDoc && failedDoc.r2Key) {
        console.log(`[RAG Cleanup] Deleting failed file from Cloudflare R2: "${failedDoc.r2Key}"...`);
        await deleteFileFromR2({ key: failedDoc.r2Key });
      }
      // Also ensure any partial vectors are removed from Qdrant
      await deleteDocumentVectors(documentId);
    } catch (cleanupErr) {
      console.warn(`[RAG Cleanup] Warning during failure cleanup: ${cleanupErr.message}`);
    }

    // Update document status to 'failed' in MongoDB
    await Document.findByIdAndUpdate(documentId, {
      status: 'failed',
      errorMessage: error.message,
    });

    return {
      success: false,
      documentId,
      error: error.message,
    };
  }
};

export default {
  processDocumentForRag,
};
