import crypto from 'crypto';
import mongoose from 'mongoose';
import path from 'path';
import Document from '../models/Document.js';
import {
  uploadBufferToR2,
  getPresignedR2ViewUrl,
  deleteFileFromR2,
  getLocalFallbackBuffer,
} from '../services/r2.service.js';
import { processDocumentForRag } from '../services/ingestion.service.js';
import { deleteDocumentVectors, deleteUserVectors } from '../services/qdrant.service.js';
import {
  validateAndExtractZip,
  detectFileType,
  sanitizeEntryFilename,
  SUPPORTED_EXTENSIONS,
} from '../services/zip.service.js';

// Allowed single upload extensions (Documents & Images)
const ALLOWED_EXTENSIONS = [
  ...SUPPORTED_EXTENSIONS.DOCUMENTS,
  ...SUPPORTED_EXTENSIONS.IMAGES,
];
const ZIP_EXTENSIONS = ['zip'];

/**
 * Controlled Concurrency Worker Pool
 */
async function runWorkerPool(items, concurrency, workerFn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await workerFn(items[i], i);
      } catch (err) {
        results[i] = { error: err };
      }
    }
  });
  await Promise.all(workers);
  return results;
}


/**
 * Sanitize filename for storage (safe characters only)
 */
const sanitizeFilename = (filename) => {
  return sanitizeEntryFilename(filename);
};

/**
 * Upload single or multiple documents (including secure ZIP extraction) to Cloudflare R2
 * POST /api/documents/upload
 */
export const uploadDocuments = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided for upload.',
      });
    }

    const savedDocuments = [];
    const errors = [];
    const ragProcessingQueue = [];
    const archiveResults = [];

    // Process each uploaded file in request
    for (const file of req.files) {
      const originalName = file.originalname || 'document';
      const fileExt = (originalName.split('.').pop() || '').toLowerCase();

      // CASE A: ZIP Archive Handling with full security validations
      if (ZIP_EXTENSIONS.includes(fileExt)) {
        try {
          console.log(`[ZIP Ingestion] Processing archive "${originalName}" (${(file.buffer.length / 1024).toFixed(1)} KB)...`);
          const tZipStart = Date.now();
          const extractionResult = await validateAndExtractZip(file.buffer, originalName);
          const zipExtractMs = Date.now() - tZipStart;

          const archiveManifest = {
            archive: originalName,
            totalFiles: extractionResult.totalFiles,
            processed: 0,
            skipped: extractionResult.skipped,
            failed: extractionResult.failed,
            files: [],
          };

          // Record skipped entries in manifest
          for (const s of extractionResult.skippedFiles) {
            archiveManifest.files.push({
              filename: s.originalFileName,
              relativePath: s.relativePath,
              status: 'skipped',
              reason: s.reason,
            });
          }

          // Record failed entries in manifest
          for (const f of extractionResult.failedFiles) {
            archiveManifest.files.push({
              filename: f.originalFileName,
              relativePath: f.relativePath,
              status: 'failed',
              error: f.error,
            });
          }

          // Ingest each valid extracted document/image with controlled concurrency & SHA-256 deduplication
          const R2_UPLOAD_CONCURRENCY = parseInt(process.env.R2_UPLOAD_CONCURRENCY || '8', 10);
          
          await runWorkerPool(extractionResult.files, R2_UPLOAD_CONCURRENCY, async (extractedFile) => {
            try {
              const cleanFilename = extractedFile.cleanFilename;
              const fileHash = crypto.createHash('sha256').update(extractedFile.buffer).digest('hex');

              // SHA-256 Deduplication: Check if identical ready document already exists for user
              const existingDoc = await Document.findOne({
                userId,
                sha256Hash: fileHash,
                status: 'ready',
              }).lean();

              const docId = new mongoose.Types.ObjectId();
              const r2Key = existingDoc
                ? existingDoc.r2Key
                : `users/${userId}/documents/${docId}/${cleanFilename}`;

              const tR2Start = Date.now();
              if (!existingDoc) {
                // Upload buffer to Cloudflare R2 only if new
                await uploadBufferToR2({
                  key: r2Key,
                  buffer: extractedFile.buffer,
                  contentType: extractedFile.mimeType,
                  metadata: {
                    userId: userId.toString(),
                    documentId: docId.toString(),
                    originalName: extractedFile.originalFileName,
                    parentZip: originalName,
                    relativePath: extractedFile.relativePath,
                  },
                });
              }
              const r2DurationMs = existingDoc ? 0 : (Date.now() - tR2Start);

              // Create Document record in MongoDB
              const title = extractedFile.originalFileName
                .replace(/\.[^/.]+$/, '')
                .replace(/[-_]/g, ' ');

              const tMongoStart = Date.now();
              const docRecord = await Document.create({
                _id: docId,
                userId,
                title,
                filename: cleanFilename,
                originalName: extractedFile.originalFileName,
                fileType: extractedFile.fileType,
                extension: extractedFile.extension,
                mimeType: extractedFile.mimeType,
                sizeBytes: extractedFile.sizeBytes,
                sizeFormatted: Document.formatFileSize(extractedFile.sizeBytes),
                r2Key,
                sha256Hash: fileHash,
                status: existingDoc ? 'ready' : 'uploaded',
                source: 'zip_extract',
                parentZipName: originalName,
                collectionName: 'general',
                metadata: existingDoc?.metadata || {
                  archiveName: originalName,
                  relativePath: extractedFile.relativePath,
                  extractedAt: new Date().toISOString(),
                  deduplicated: Boolean(existingDoc),
                },
              });
              const mongoDurationMs = Date.now() - tMongoStart;

              extractedFile._timings = { r2Ms: r2DurationMs, mongoMs: mongoDurationMs };
              savedDocuments.push(docRecord);
              archiveManifest.processed++;

              archiveManifest.files.push({
                documentId: docId.toString(),
                filename: cleanFilename,
                originalFileName: extractedFile.originalFileName,
                relativePath: extractedFile.relativePath,
                fileType: extractedFile.fileType,
                mimeType: extractedFile.mimeType,
                sizeBytes: extractedFile.sizeBytes,
                status: 'processed',
                deduplicated: Boolean(existingDoc),
              });

              // If new, enqueue for RAG indexing
              if (!existingDoc) {
                ragProcessingQueue.push({
                  documentId: docId,
                  userId,
                  buffer: extractedFile.buffer,
                  filename: cleanFilename,
                  originalName: extractedFile.originalFileName,
                  fileType: extractedFile.fileType,
                  mimeType: extractedFile.mimeType,
                  parentZipName: originalName,
                  relativePath: extractedFile.relativePath,
                });
              }
            } catch (fileIngestErr) {
              console.error(`[ZIP Ingestion] Failed to ingest extracted file "${extractedFile.relativePath}":`, fileIngestErr);
              archiveManifest.failed++;
              archiveManifest.files.push({
                filename: extractedFile.originalFileName,
                relativePath: extractedFile.relativePath,
                status: 'failed',
                error: fileIngestErr.message,
              });
            }
          });

          archiveResults.push(archiveManifest);

          if (archiveManifest.processed === 0 && archiveManifest.failed > 0) {
            errors.push({
              file: originalName,
              error: `ZIP archive processing failed: ${archiveManifest.files.filter(f => f.status === 'failed').map(f => f.error).join('; ')}`,
            });
          } else if (archiveManifest.processed === 0 && archiveManifest.skipped > 0) {
            errors.push({
              file: originalName,
              error: 'No supported documents (.pdf, .docx, .txt, .md) or images (.png, .jpg, .jpeg, .webp) found inside ZIP archive.',
            });
          }
        } catch (zipErr) {
          console.error(`[ZIP Ingestion] Archive error for "${originalName}":`, zipErr);
          errors.push({
            file: originalName,
            error: zipErr.message || 'Failed to decompress ZIP archive.',
          });
        }
      }

      // CASE B: Direct Document / Image Upload (.pdf, .docx, .txt, .md, .png, .jpg, .jpeg, .webp)
      else if (ALLOWED_EXTENSIONS.includes(fileExt)) {
        try {
          const cleanFilename = sanitizeFilename(originalName);
          const docId = new mongoose.Types.ObjectId();
          const r2Key = `users/${userId}/documents/${docId}/${cleanFilename}`;
          const typeInfo = detectFileType(cleanFilename);
          const fileMimeType = file.mimetype && file.mimetype !== 'application/octet-stream'
            ? file.mimetype
            : typeInfo.mimeType;

          // Upload buffer directly to Cloudflare R2
          await uploadBufferToR2({
            key: r2Key,
            buffer: file.buffer,
            contentType: fileMimeType,
            metadata: {
              userId: userId.toString(),
              documentId: docId.toString(),
              originalName,
            },
          });

          // Save Document Record in MongoDB (starts in 'uploaded' state)
          const docRecord = await Document.create({
            _id: docId,
            userId,
            title: cleanFilename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
            filename: cleanFilename,
            originalName,
            fileType: typeInfo.fileType,
            extension: typeInfo.extension,
            mimeType: fileMimeType,
            sizeBytes: file.buffer.length,
            sizeFormatted: Document.formatFileSize(file.buffer.length),
            r2Key,
            status: 'uploaded',
            source: 'direct_upload',
            collectionName: 'general',
          });

          savedDocuments.push(docRecord);

          // Enqueue for async RAG processing
          ragProcessingQueue.push({
            documentId: docId,
            userId,
            buffer: file.buffer,
            filename: cleanFilename,
            originalName,
            fileType: typeInfo.fileType,
            mimeType: fileMimeType,
            parentZipName: null,
            relativePath: null,
          });
        } catch (uploadErr) {
          console.error(`Upload error for ${originalName}:`, uploadErr);
          errors.push({
            file: originalName,
            error: `Failed to upload to storage: ${uploadErr.message}`,
          });
        }
      } else {
        errors.push({
          file: originalName,
          error: `Unsupported file type (.${fileExt}). Supported formats: PDF, DOCX, TXT, MD, ZIP, PNG, JPG, JPEG, WEBP.`,
        });
      }
    }

    if (savedDocuments.length === 0 && errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.map((e) => `${e.file}: ${e.error}`).join(' | '),
        errors,
        archive: archiveResults[0]?.archive,
        totalFiles: archiveResults[0]?.totalFiles,
        processed: archiveResults[0]?.processed || 0,
        skipped: archiveResults[0]?.skipped || 0,
        failed: archiveResults[0]?.failed || 0,
        files: archiveResults[0]?.files || [],
      });
    }

    // Trigger async RAG processing pipeline with prioritized concurrency & worker pools
    if (ragProcessingQueue.length > 0) {
      (async () => {
        const ingStart = Date.now();
        const RAG_INGESTION_CONCURRENCY = parseInt(process.env.RAG_INGESTION_CONCURRENCY || '4', 10);
        let totalZipExtractMs = archiveResults.reduce((acc, a) => acc + (a._zipExtractMs || 0), 0);
        let totalDocExtractMs = 0;
        let totalVisionMs = 0;
        let totalChunkingMs = 0;
        let totalEmbeddingMs = 0;
        let totalQdrantMs = 0;
        let totalMongoMs = savedDocuments.reduce((acc, d) => acc + (d._timings?.mongoMs || 0), 0);
        let totalR2Ms = savedDocuments.reduce((acc, d) => acc + (d._timings?.r2Ms || 0), 0);
        let totalChunks = 0;
        let totalEmbedRequests = 0;
        let totalVisionRequests = 0;

        // Separate Priority 1: Text Documents (PDF, DOCX, TXT, MD) vs Priority 2: Visual Assets (IMAGE)
        const textQueue = ragProcessingQueue.filter((item) => item.fileType !== 'IMAGE' && !/\.(png|jpe?g|webp)$/i.test(item.filename));
        const visionQueue = ragProcessingQueue.filter((item) => item.fileType === 'IMAGE' || /\.(png|jpe?g|webp)$/i.test(item.filename));

        console.log(`\n[RAG Ingestion Pool] Starting concurrent processing for ${textQueue.length} text document(s) (Concurrency: ${RAG_INGESTION_CONCURRENCY}) and ${visionQueue.length} visual asset(s)...\n`);

        // Phase 1: Process text documents with worker pool so corpus becomes searchable immediately!
        await runWorkerPool(textQueue, RAG_INGESTION_CONCURRENCY, async (item) => {
          try {
            const ragRes = await processDocumentForRag(item);
            if (ragRes && ragRes.timings) {
              totalDocExtractMs += ragRes.timings.extractionMs;
              totalChunkingMs += ragRes.timings.chunkingMs;
              totalEmbeddingMs += ragRes.timings.embeddingMs;
              totalQdrantMs += ragRes.timings.qdrantMs;
              totalMongoMs += ragRes.timings.mongoMs;
              totalChunks += ragRes.timings.chunksCount || 0;
              totalEmbedRequests += Math.ceil((ragRes.timings.chunksCount || 1) / 16);
            }
          } catch (ragErr) {
            console.error(`Background RAG text processing failed for ${item.filename}:`, ragErr.message);
          }
        });

        console.log(`\n[RAG Ingestion Pool] All ${textQueue.length} text documents are READY and searchable in Qdrant! Now indexing visual assets...\n`);

        // Phase 2: Process visual assets with controlled concurrency (e.g. 1-2 to preserve GPU VRAM)
        const VISION_CONCURRENCY = parseInt(process.env.VISION_CONCURRENCY_LIMIT || '2', 10);
        await runWorkerPool(visionQueue, VISION_CONCURRENCY, async (item) => {
          try {
            const ragRes = await processDocumentForRag(item);
            if (ragRes && ragRes.timings) {
              totalVisionMs += ragRes.timings.extractionMs;
              totalVisionRequests++;
              totalChunkingMs += ragRes.timings.chunkingMs;
              totalEmbeddingMs += ragRes.timings.embeddingMs;
              totalQdrantMs += ragRes.timings.qdrantMs;
              totalMongoMs += ragRes.timings.mongoMs;
              totalChunks += ragRes.timings.chunksCount || 0;
              totalEmbedRequests += Math.ceil((ragRes.timings.chunksCount || 1) / 16);
            }
          } catch (ragErr) {
            console.error(`Background RAG vision processing failed for ${item.filename}:`, ragErr.message);
          }
        });

        const totalIngMs = Date.now() - ingStart + totalZipExtractMs + totalR2Ms;
        console.log('\n========== INGESTION PERFORMANCE ==========');
        console.log(`\nZIP extraction          ${(totalZipExtractMs / 1000).toFixed(1)}s`);
        console.log(`Document extraction     ${(totalDocExtractMs / 1000).toFixed(1)}s`);
        console.log(`Image/Vision processing ${(totalVisionMs / 1000).toFixed(1)}s`);
        console.log(`Chunking                ${(totalChunkingMs / 1000).toFixed(1)}s`);
        console.log(`Embedding generation    ${(totalEmbeddingMs / 1000).toFixed(1)}s`);
        console.log(`Qdrant upserts          ${(totalQdrantMs / 1000).toFixed(1)}s`);
        console.log(`MongoDB operations      ${(totalMongoMs / 1000).toFixed(1)}s`);
        console.log(`R2 operations           ${(totalR2Ms / 1000).toFixed(1)}s`);
        console.log(`\nFiles processed: ${ragProcessingQueue.length}`);
        console.log(`Chunks generated: ${totalChunks}`);
        console.log(`Embedding requests: ${totalEmbedRequests}`);
        console.log(`Vision requests: ${totalVisionRequests}`);
        console.log(`\nTotal: ${(totalIngMs / 1000).toFixed(1)} seconds`);
        console.log('===========================================\n');
      })();
    }

    const primaryArchive = archiveResults[0] || null;

    return res.status(201).json({
      success: true,
      message: `${savedDocuments.length} document${savedDocuments.length > 1 ? 's' : ''} stored securely in Cloudflare R2 and submitted for RAG indexing.`,
      archive: primaryArchive?.archive,
      totalFiles: primaryArchive?.totalFiles,
      processed: primaryArchive?.processed,
      skipped: primaryArchive?.skipped,
      failed: primaryArchive?.failed,
      files: primaryArchive?.files,
      archives: archiveResults.length > 0 ? archiveResults : undefined,
      documents: savedDocuments,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in uploadDocuments:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during document upload.',
    });
  }
};

/**
 * Get all documents for the authenticated user
 * GET /api/documents
 */
export const getUserDocuments = async (req, res) => {
  try {
    const userId = req.user._id;

    const documents = await Document.find({ userId }).sort({ createdAt: -1 });

    const totalSizeBytes = documents.reduce((acc, d) => acc + (d.sizeBytes || 0), 0);
    const totalSizeFormatted = Document.formatFileSize(totalSizeBytes);

    return res.status(200).json({
      success: true,
      count: documents.length,
      totalSizeBytes,
      totalSizeFormatted,
      documents,
    });
  } catch (error) {
    console.error('Error in getUserDocuments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve documents.',
    });
  }
};

/**
 * Generate a private presigned URL to view/download a document
 * GET /api/documents/:id/view-url
 */
export const getDocumentViewUrl = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or access denied.',
      });
    }

    const presignedUrl = await getPresignedR2ViewUrl({
      key: document.r2Key,
      expiresInSeconds: 900, // 15 mins
    });

    return res.status(200).json({
      success: true,
      viewUrl: presignedUrl,
      document: {
        id: document._id,
        title: document.title,
        filename: document.filename,
        fileType: document.fileType,
        mimeType: document.mimeType,
        sizeFormatted: document.sizeFormatted,
      },
    });
  } catch (error) {
    console.error('Error in getDocumentViewUrl:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate document view URL.',
    });
  }
};

/**
 * Delete a document from Cloudflare R2, MongoDB, and Qdrant Cloud vectors
 * DELETE /api/documents/:id
 */
export const deleteDocument = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or access denied.',
      });
    }

    // 1. Delete vector embeddings from Qdrant Cloud
    try {
      await deleteDocumentVectors(id);
    } catch (qdrantErr) {
      console.warn(`Failed to delete Qdrant points for doc ${id}:`, qdrantErr.message);
    }

    // 2. Delete raw file from Cloudflare R2
    try {
      await deleteFileFromR2(document.r2Key);
    } catch (r2Err) {
      console.warn(`Failed to delete R2 object ${document.r2Key}:`, r2Err.message);
    }

    // 3. Delete document record from MongoDB
    await Document.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Document permanently deleted from storage and search index.',
    });
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete document.',
    });
  }
};

/**
 * Permanently delete ALL documents for the authenticated user from Cloudflare R2, MongoDB, and Qdrant Cloud vectors
 * DELETE /api/documents/all
 */
export const deleteAllDocuments = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Fetch all user documents to get storage keys
    const documents = await Document.find({ userId });

    if (!documents || documents.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No documents found to delete.',
        deletedCount: 0,
      });
    }

    const docIds = documents.map((d) => d._id);

    // 2. Delete raw files from Cloudflare R2 in parallel
    try {
      const deletePromises = documents.map((doc) => {
        if (doc.r2Key) {
          return deleteFileFromR2({ key: doc.r2Key }).catch((err) => {
            console.warn(`[Delete All] Failed to delete R2 object ${doc.r2Key}:`, err.message);
          });
        }
        return Promise.resolve();
      });
      await Promise.allSettled(deletePromises);
    } catch (r2Err) {
      console.warn('[Delete All] Error deleting objects from R2:', r2Err.message);
    }

    // 3. Delete vector embeddings from Qdrant Cloud
    try {
      await deleteUserVectors(userId, docIds);
    } catch (qdrantErr) {
      console.warn('[Delete All] Error deleting Qdrant points:', qdrantErr.message);
    }

    // 4. Delete document records from MongoDB
    const result = await Document.deleteMany({ userId });

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount || documents.length} files from repository and vector index.`,
      deletedCount: result.deletedCount || documents.length,
    });
  } catch (error) {
    console.error('Error in deleteAllDocuments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete all documents.',
    });
  }
};

/**
 * Stream local fallback document when R2 is not configured
 * GET /api/documents/stream/:key
 */
export const streamLocalDocument = async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const buffer = await getLocalFallbackBuffer(key);

    if (!buffer) {
      return res.status(404).send('Document not found in local storage.');
    }

    res.setHeader('Content-Disposition', 'inline');
    res.send(buffer);
  } catch (err) {
    res.status(500).send(`Error streaming document: ${err.message}`);
  }
};

export default {
  uploadDocuments,
  getUserDocuments,
  getDocumentViewUrl,
  streamLocalDocument,
  deleteDocument,
  deleteAllDocuments,
};
