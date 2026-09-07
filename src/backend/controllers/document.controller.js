import mongoose from 'mongoose';
import AdmZip from 'adm-zip';
import path from 'path';
import Document from '../models/Document.js';
import {
  uploadBufferToR2,
  getPresignedR2ViewUrl,
  deleteFileFromR2,
  getLocalFallbackBuffer,
} from '../services/r2.service.js';
import { processDocumentForRag } from '../services/ingestion.service.js';
import { deleteDocumentVectors } from '../services/qdrant.service.js';


// Allowed file extensions (Documents & Images)
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'markdown', 'png', 'jpg', 'jpeg', 'webp'];
const ZIP_EXTENSIONS = ['zip'];

// Maximum bounds for ZIP decompression safety
const MAX_ZIP_FILES = 100;
const MAX_ZIP_UNCOMPRESSED_BYTES = 300 * 1024 * 1024; // 300 MB

/**
 * Sanitize filename for storage (safe characters only)
 */
const sanitizeFilename = (filename) => {
  const baseName = path.basename(filename);
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Upload single or multiple documents (including ZIP extraction) to Cloudflare R2
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

    // Process each uploaded file
    for (const file of req.files) {
      const originalName = file.originalname || 'document';
      const fileExt = (originalName.split('.').pop() || '').toLowerCase();

      // CASE A: ZIP Archive Handling with Zip Slip & Zip Bomb defenses
      if (ZIP_EXTENSIONS.includes(fileExt)) {
        try {
          const zip = new AdmZip(file.buffer);
          const zipEntries = zip.getEntries();

          let totalExtractedBytes = 0;
          let extractedCount = 0;

          // Check ZIP bomb threshold (file count)
          if (zipEntries.length > MAX_ZIP_FILES) {
            errors.push({
              file: originalName,
              error: `ZIP archive contains ${zipEntries.length} files (maximum allowed is ${MAX_ZIP_FILES}).`,
            });
            continue;
          }

          for (const entry of zipEntries) {
            // Ignore directories and macOS metadata
            if (entry.isDirectory || entry.entryName.startsWith('__MACOSX/')) {
              continue;
            }

            const rawEntryName = entry.entryName;

            // Zip Slip Defense: Reject path traversal attempts
            if (
              rawEntryName.includes('..') ||
              path.isAbsolute(rawEntryName) ||
              rawEntryName.startsWith('/') ||
              rawEntryName.startsWith('\\')
            ) {
              console.warn(`[Security Alert] Zip Slip path traversal attempted: ${rawEntryName}`);
              continue;
            }

            const cleanEntryName = sanitizeFilename(rawEntryName);
            const entryExt = (cleanEntryName.split('.').pop() || '').toLowerCase();

            // Ignore unsupported files inside ZIP
            if (!ALLOWED_EXTENSIONS.includes(entryExt)) {
              continue;
            }

            const entryData = entry.getData();
            totalExtractedBytes += entryData.length;

            // Zip Bomb Defense: Cumulative uncompressed size check
            if (totalExtractedBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
              errors.push({
                file: originalName,
                error: `Decompressed size exceeded maximum threshold of ${MAX_ZIP_UNCOMPRESSED_BYTES / (1024 * 1024)} MB.`,
              });
              break;
            }

            // Create Unique Document in R2 & MongoDB
            const docId = new mongoose.Types.ObjectId();
            const r2Key = `users/${userId}/documents/${docId}/${cleanEntryName}`;
            const { fileType, extension } = Document.detectFileType(cleanEntryName);

            // Upload uncompressed buffer to Cloudflare R2
            await uploadBufferToR2({
              key: r2Key,
              buffer: entryData,
              contentType: file.mimetype || 'application/octet-stream',
              metadata: {
                userId: userId.toString(),
                documentId: docId.toString(),
                originalName: cleanEntryName,
                parentZip: originalName,
              },
            });

            // Save Document Record in MongoDB (starts in 'uploaded' state)
            const docRecord = await Document.create({
              _id: docId,
              userId,
              title: cleanEntryName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
              filename: cleanEntryName,
              originalName: cleanEntryName,
              fileType,
              extension,
              mimeType: file.mimetype || 'application/octet-stream',
              sizeBytes: entryData.length,
              sizeFormatted: Document.formatFileSize(entryData.length),
              r2Key,
              status: 'uploaded',
              source: 'zip_extract',
              parentZipName: originalName,
              collectionName: 'general',
            });

            savedDocuments.push(docRecord);
            extractedCount++;

            // Enqueue for async RAG processing
            ragProcessingQueue.push({
              documentId: docId,
              userId,
              buffer: entryData,
              filename: cleanEntryName,
              fileType,
            });
          }

          if (extractedCount === 0) {
            errors.push({
              file: originalName,
              error: 'No supported documents (.pdf, .docx, .txt, .md) found inside ZIP archive.',
            });
          }
        } catch (zipErr) {
          console.error(`ZIP processing error for ${originalName}:`, zipErr);
          errors.push({
            file: originalName,
            error: `Failed to decompress ZIP archive: ${zipErr.message}`,
          });
        }
      }

      // CASE B: Direct Document Upload (.pdf, .docx, .txt, .md, .markdown)
      else if (ALLOWED_EXTENSIONS.includes(fileExt)) {
        try {
          const cleanFilename = sanitizeFilename(originalName);
          const docId = new mongoose.Types.ObjectId();
          const r2Key = `users/${userId}/documents/${docId}/${cleanFilename}`;
          const { fileType, extension } = Document.detectFileType(cleanFilename);

          // Upload buffer directly to Cloudflare R2
          await uploadBufferToR2({
            key: r2Key,
            buffer: file.buffer,
            contentType: file.mimetype || 'application/octet-stream',
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
            fileType,
            extension,
            mimeType: file.mimetype || 'application/octet-stream',
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
            fileType,
            mimeType: file.mimetype || 'application/octet-stream',
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
      });
    }

    // Trigger async RAG processing pipeline for all uploaded documents in background
    if (ragProcessingQueue.length > 0) {
      (async () => {
        for (const item of ragProcessingQueue) {
          try {
            await processDocumentForRag(item);
          } catch (ragErr) {
            console.error(`Background RAG processing failed for ${item.filename}:`, ragErr);
          }
        }
      })();
    }

    return res.status(201).json({
      success: true,
      message: `${savedDocuments.length} document${savedDocuments.length > 1 ? 's' : ''} stored securely in Cloudflare R2 and submitted for RAG indexing.`,
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
      message: 'Failed to generate secure view URL.',
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

/**
 * Delete a document from Cloudflare R2, MongoDB Document collection, and MongoDB Chunk collection
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

    // 1. Delete from Cloudflare R2
    await deleteFileFromR2({ key: document.r2Key });

    // 2. Cascade delete all vector points from Qdrant Cloud
    await deleteDocumentVectors(id);

    // 3. Delete from MongoDB Document metadata collection
    await document.deleteOne();

    return res.status(200).json({
      success: true,
      message: `Document "${document.title}" and its Qdrant vector embeddings removed successfully.`,
      deletedId: id,
    });

  } catch (error) {
    console.error('Error in deleteDocument:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete document.',
    });
  }
};
