import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['PDF', 'DOCX', 'TXT', 'MD', 'IMAGE', 'OTHER'],
      default: 'OTHER',
      uppercase: true,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    extension: {
      type: String,
      lowercase: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },
    sizeFormatted: {
      type: String,
      default: '0 KB',
    },
    r2Key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    r2Bucket: {
      type: String,
      required: true,
      default: 'tracemind-documents',
    },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'analyzing', 'indexed', 'ready', 'failed'],
      default: 'uploaded',
      index: true,
    },
    source: {
      type: String,
      enum: ['direct_upload', 'zip_extract'],
      default: 'direct_upload',
    },
    parentZipName: {
      type: String,
      default: null,
    },
    collectionName: {
      type: String,
      default: 'general',
      trim: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Format file size helper utility
documentSchema.statics.formatFileSize = function (bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Detect standardized file type
documentSchema.statics.detectFileType = function (filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'pdf':
      return { fileType: 'PDF', extension: 'pdf' };
    case 'docx':
      return { fileType: 'DOCX', extension: 'docx' };
    case 'txt':
      return { fileType: 'TXT', extension: 'txt' };
    case 'md':
    case 'markdown':
      return { fileType: 'MD', extension: ext };
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
      return { fileType: 'IMAGE', extension: ext };
    default:
      return { fileType: 'OTHER', extension: ext };
  }
};

const Document = mongoose.model('Document', documentSchema);

export default Document;
