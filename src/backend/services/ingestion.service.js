import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import { extractDocumentText } from './extractor.service.js';
import { createDocumentChunks } from './chunking.service.js';
import { generateBatchEmbeddings } from './ollama.service.js';

/**
 * RAG Ingestion Pipeline Service
 * Orchestrates text extraction -> semantic chunking -> RunPod Ollama embedding -> vector database storage
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
    // 1. Mark document status as 'processing'
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
      `✅ [RAG Pipeline] Generated ${rawChunks.length} RAG chunk(s). Generating RunPod Ollama embeddings...`
    );

    // 4. Generate embeddings via RunPod Ollama in parallel batches
    const embeddings = await generateBatchEmbeddings(rawChunks, 4);

    // 5. Save vector chunks into MongoDB
    const chunkDocuments = rawChunks.map((chunk, index) => ({
      documentId: chunk.documentId,
      userId: chunk.userId,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
      fileName: chunk.fileName,
      charCount: chunk.charCount,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[index] || [],
      metadata: chunk.metadata,
    }));

    // Delete any stale chunks for this document before inserting
    await Chunk.deleteMany({ documentId });
    await Chunk.insertMany(chunkDocuments);

    console.log(
      `💾 [RAG Pipeline] Stored ${chunkDocuments.length} vector chunks in database.`
    );

    // 6. Update Document status to 'ready'
    await Document.findByIdAndUpdate(documentId, {
      status: 'ready',
      metadata: {
        chunksCount: chunkDocuments.length,
        totalPages: extractionResult.totalPages,
        processedAt: new Date(),
      },
    });

    console.log(`🎉 [RAG Pipeline] Document "${filename}" is READY for RAG!\n`);
    return {
      success: true,
      documentId,
      chunksCount: chunkDocuments.length,
      totalPages: extractionResult.totalPages,
    };
  } catch (error) {
    console.error(
      `❌ [RAG Pipeline] Processing failed for "${filename}":`,
      error.message
    );

    // Update document status to 'failed'
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
