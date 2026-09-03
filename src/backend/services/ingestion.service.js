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
  fileType,
}) => {
  console.log(`\n⚙️ [RAG Pipeline] Processing document: "${filename}" (ID: ${documentId})`);

  try {
    // 1. Mark document status as 'processing' in MongoDB
    await Document.findByIdAndUpdate(documentId, {
      status: 'processing',
      errorMessage: null,
    });

    // 2. Extract text from document buffer (PDF / DOCX / TXT / Markdown)
    console.log(`📄 [RAG Pipeline] Extracting text for: "${filename}"...`);
    const extractionResult = await extractDocumentText({
      buffer,
      filename,
      fileType,
    });

    if (!extractionResult.fullText || !extractionResult.fullText.trim()) {
      throw new Error(
        'Document appears empty or contains no extractable text.'
      );
    }

    console.log(
      `✅ [RAG Pipeline] Extracted ${extractionResult.fullText.length} characters across ${extractionResult.totalPages} page(s).`
    );

    // 3. Create semantic chunks (~1000 tokens, 10-15% overlap)
    console.log(`🧩 [RAG Pipeline] Chunking text with 10-15% overlap...`);
    const rawChunks = createDocumentChunks({
      pages: extractionResult.pages,
      fullText: extractionResult.fullText,
      documentId,
      userId,
      fileName: filename,
      targetTokens: 1000,
      overlapPercent: 0.12, // 12%
    });

    if (rawChunks.length === 0) {
      throw new Error('No valid text chunks could be generated from document.');
    }

    console.log(
      `✅ [RAG Pipeline] Generated ${rawChunks.length} RAG chunk(s). Generating Nomic embeddings on RunPod Ollama...`
    );

    // 4. Generate embeddings via RunPod Ollama (Nomic Embed Text) in parallel batches
    const embeddings = await generateBatchEmbeddings(rawChunks, 4);

    // 5. Store chunk text, embedding vectors, and metadata in Qdrant Cloud (NOT MongoDB)
    console.log(`🔷 [RAG Pipeline] Uploading vector chunks to Qdrant Cloud...`);
    const qdrantResult = await upsertDocumentChunks({
      documentId,
      userId,
      fileName: filename,
      chunks: rawChunks,
      vectors: embeddings,
    });

    // 6. Only mark document 'ready' in MongoDB after all chunks are successfully stored in Qdrant
    await Document.findByIdAndUpdate(documentId, {
      status: 'ready',
      metadata: {
        chunksCount: rawChunks.length,
        totalPages: extractionResult.totalPages,
        vectorStorage: qdrantResult.storage || 'qdrant_cloud',
        processedAt: new Date(),
      },
    });

    console.log(
      `🎉 [RAG Pipeline] Document "${filename}" is READY in Qdrant Cloud for RAG retrieval!\n`
    );

    return {
      success: true,
      documentId,
      chunksCount: rawChunks.length,
      totalPages: extractionResult.totalPages,
      storage: qdrantResult.storage,
    };
  } catch (error) {
    console.error(
      `❌ [RAG Pipeline] Processing failed for "${filename}":`,
      error.message
    );

    // Clean up: Delete stored file from Cloudflare R2 on vectorization failure
    try {
      const failedDoc = await Document.findById(documentId);
      if (failedDoc && failedDoc.r2Key) {
        console.log(`🗑️ [RAG Cleanup] Deleting failed file from Cloudflare R2: "${failedDoc.r2Key}"...`);
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
