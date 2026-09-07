import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.middleware.js';
import {
  uploadDocuments,
  getUserDocuments,
  getDocumentViewUrl,
  streamLocalDocument,
  deleteDocument,
} from '../controllers/document.controller.js';

const router = express.Router();

// Configure Multer for In-Memory Buffer Streaming (up to 300 MB combined limit)
const maxFileSizeMB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '300', 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024,
    files: 50, // max 50 files per batch
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['pdf', 'docx', 'txt', 'md', 'markdown', 'zip', 'png', 'jpg', 'jpeg', 'webp'];
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file format (.${ext}). Supported formats: PDF, DOCX, TXT, MD, ZIP, PNG, JPG, JPEG, WEBP.`
        ),
        false
      );
    }
  },
});

// Middleware to handle multer file errors gracefully
const handleUploadMiddleware = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `File size exceeds the maximum limit of ${maxFileSizeMB} MB.`,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    }
    next();
  });
};

// Document Management Endpoints

router.post('/upload', protect, handleUploadMiddleware, uploadDocuments);
router.get('/', protect, getUserDocuments);
router.get('/:id/view-url', protect, getDocumentViewUrl);
router.get('/stream/:key', streamLocalDocument);
router.delete('/:id', protect, deleteDocument);

export default router;
