import AdmZip from 'adm-zip';
import path from 'path';

/**
 * Supported File Extensions
 */
export const SUPPORTED_EXTENSIONS = {
  DOCUMENTS: ['pdf', 'docx', 'txt', 'md', 'markdown'],
  IMAGES: ['png', 'jpg', 'jpeg', 'webp'],
};

/**
 * Dangerous file extensions that must be rejected/ignored
 */
const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'mjs', 'cjs',
  'py', 'dll', 'so', 'bin', 'com', 'scr', 'msi', 'jar', 'apk',
  'elf', 'app', 'dmg', 'iso'
];

/**
 * Nested archive extensions (reject to prevent archive bomb/recursive extraction abuse)
 */
const NESTED_ARCHIVE_EXTENSIONS = ['zip', 'tar', 'gz', 'bz2', 'xz', 'rar', '7z', 'tgz'];

/**
 * Standard MIME Type Map for supported files
 */
const MIME_TYPE_MAP = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Configurable Limits for Safe ZIP Decompression
 */
export const ZIP_LIMITS = {
  MAX_FILES: parseInt(process.env.MAX_ZIP_FILES || '500', 10), // Max allowed files per archive (increased to 500)
  MAX_TOTAL_UNCOMPRESSED_BYTES: parseInt(process.env.MAX_ZIP_UNCOMPRESSED_MB || '800', 10) * 1024 * 1024, // 800 MB
  MAX_SINGLE_FILE_BYTES: 100 * 1024 * 1024,        // 100 MB
  MAX_FOLDER_DEPTH: 8,                      // Max directory nesting levels
  MAX_COMPRESSION_RATIO: 100,               // 100:1 compression ratio limit (zip bomb defense)
};

/**
 * Validate that buffer starts with valid ZIP magic bytes
 * - PK\x03\x04 (standard zip header)
 * - PK\x05\x06 (empty zip)
 * - PK\x07\x08 (spanned/split zip)
 */
export const hasValidZipSignature = (buffer) => {
  if (!buffer || buffer.length < 4) return false;
  return (
    (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) ||
    (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x05 && buffer[3] === 0x06) ||
    (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x07 && buffer[3] === 0x08)
  );
};

/**
 * Detect standardized file type and MIME type
 */
export const detectFileType = (filename) => {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (SUPPORTED_EXTENSIONS.DOCUMENTS.includes(ext)) {
    const docType = ext === 'markdown' ? 'MD' : ext.toUpperCase();
    return {
      fileType: docType,
      category: 'document',
      mimeType: MIME_TYPE_MAP[ext] || 'application/octet-stream',
      extension: ext,
      isSupported: true,
      isImage: false,
    };
  }
  if (SUPPORTED_EXTENSIONS.IMAGES.includes(ext)) {
    return {
      fileType: 'IMAGE',
      category: 'image',
      mimeType: MIME_TYPE_MAP[ext] || 'image/png',
      extension: ext,
      isSupported: true,
      isImage: true,
    };
  }
  return {
    fileType: 'OTHER',
    category: 'other',
    mimeType: 'application/octet-stream',
    extension: ext,
    isSupported: false,
    isImage: false,
  };
};

/**
 * Normalize and sanitize a relative path inside a ZIP archive
 * Defends strictly against Zip Slip / Path Traversal:
 * - Reject entries with '..' segments
 * - Reject absolute paths (starting with '/' or '\\' or 'C:')
 * - Reject entries that navigate outside relative root
 */
export const validateAndNormalizeZipPath = (rawEntryName) => {
  if (!rawEntryName || typeof rawEntryName !== 'string') {
    return { valid: false, error: 'Empty or invalid entry path' };
  }

  // Check for absolute path or Windows drive letter (e.g. C:, D:)
  if (
    rawEntryName.startsWith('/') ||
    rawEntryName.startsWith('\\') ||
    /^[a-zA-Z]:/.test(rawEntryName) ||
    path.isAbsolute(rawEntryName)
  ) {
    return {
      valid: false,
      error: `Zip Slip rejected: Absolute path detected ("${rawEntryName}")`,
    };
  }

  // Normalize path using posix slashes
  const normalized = path.posix.normalize(rawEntryName.replace(/\\/g, '/'));

  // Path traversal checks: must not start with '..' or contain '/../'
  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.includes('/..\\') ||
    rawEntryName.includes('..')
  ) {
    return {
      valid: false,
      error: `Zip Slip rejected: Path traversal attempt detected ("${rawEntryName}")`,
    };
  }

  // Folder depth check
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length > ZIP_LIMITS.MAX_FOLDER_DEPTH) {
    return {
      valid: false,
      error: `Directory nesting depth (${segments.length}) exceeds maximum limit (${ZIP_LIMITS.MAX_FOLDER_DEPTH})`,
    };
  }

  return {
    valid: true,
    normalizedPath: normalized,
    fileName: segments[segments.length - 1],
    directory: segments.slice(0, -1).join('/'),
  };
};

/**
 * Sanitize a filename to prevent filesystem and R2 key injection
 */
export const sanitizeEntryFilename = (filename) => {
  const baseName = path.basename(filename);
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Securely validate and extract all files from a ZIP archive buffer
 * 
 * @param {Buffer} zipBuffer - Raw binary buffer of the uploaded ZIP archive
 * @param {string} originalZipName - Name of the ZIP file (e.g. 'investigation.zip')
 * @param {Object} [customLimits] - Optional overrides for limits
 * @returns {Promise<{
 *   archive: string,
 *   totalFiles: number,
 *   processed: number,
 *   skipped: number,
 *   failed: number,
 *   files: Array<Object>,
 *   skippedFiles: Array<Object>,
 *   failedFiles: Array<Object>
 * }>}
 */
export const validateAndExtractZip = async (
  zipBuffer,
  originalZipName = 'archive.zip',
  customLimits = {}
) => {
  const limits = { ...ZIP_LIMITS, ...customLimits };

  // 1. Validate magic bytes signature
  if (!hasValidZipSignature(zipBuffer)) {
    throw new Error(
      `Corrupted archive: "${originalZipName}" does not have a valid ZIP signature header.`
    );
  }

  let zip;
  let zipEntries;
  try {
    zip = new AdmZip(zipBuffer);
    zipEntries = zip.getEntries();
  } catch (err) {
    throw new Error(
      `Corrupted archive: Failed to parse ZIP structure for "${originalZipName}". Details: ${err.message}`
    );
  }

  // 2. Count verification (Archive Bomb - file count, excluding directory markers & OS metadata)
  const actualFileEntries = zipEntries.filter(
    (e) =>
      !e.isDirectory &&
      !e.entryName.startsWith('__MACOSX/') &&
      !e.entryName.includes('/.DS_Store') &&
      e.entryName !== '.DS_Store' &&
      !e.entryName.endsWith('Thumbs.db')
  );

  if (actualFileEntries.length > limits.MAX_FILES) {
    throw new Error(
      `Archive bomb rejected: "${originalZipName}" contains ${actualFileEntries.length} files (maximum allowed is ${limits.MAX_FILES}).`
    );
  }

  const validFiles = [];
  const skippedFiles = [];
  const failedFiles = [];

  let totalExtractedBytes = 0;
  const seenPaths = new Map(); // Track duplicate relative paths and basenames

  for (const entry of zipEntries) {
    // Skip directory entries and OS metadata
    if (
      entry.isDirectory ||
      entry.entryName.startsWith('__MACOSX/') ||
      entry.entryName.includes('/.DS_Store') ||
      entry.entryName === '.DS_Store' ||
      entry.entryName.endsWith('Thumbs.db')
    ) {
      continue;
    }

    const rawPath = entry.entryName;

    // 3. Zip Slip & Path Traversal Validation
    const pathCheck = validateAndNormalizeZipPath(rawPath);
    if (!pathCheck.valid) {
      console.warn(`[Security Alert] ${pathCheck.error}`);
      failedFiles.push({
        originalFileName: rawPath,
        relativePath: rawPath,
        status: 'failed',
        error: pathCheck.error,
      });
      continue;
    }

    const relativePath = pathCheck.normalizedPath;
    const baseFilename = pathCheck.fileName;
    const ext = (baseFilename.split('.').pop() || '').toLowerCase();

    // 4. Reject Dangerous Executables & Scripts
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      console.warn(`[Security Alert] Dangerous executable/script rejected in archive: "${relativePath}"`);
      skippedFiles.push({
        originalFileName: baseFilename,
        relativePath,
        status: 'skipped',
        reason: `Dangerous executable or script format (.${ext}) is not permitted.`,
      });
      continue;
    }

    // 5. Reject Nested Archives (Anti-Bomb / Recursive Extraction Abuse)
    if (NESTED_ARCHIVE_EXTENSIONS.includes(ext)) {
      console.warn(`[Security Alert] Nested archive ignored to prevent recursion abuse: "${relativePath}"`);
      skippedFiles.push({
        originalFileName: baseFilename,
        relativePath,
        status: 'skipped',
        reason: `Nested archives (.${ext}) are not expanded recursively.`,
      });
      continue;
    }

    // 6. Classification & Support Verification
    const typeInfo = detectFileType(baseFilename);
    if (!typeInfo.isSupported) {
      skippedFiles.push({
        originalFileName: baseFilename,
        relativePath,
        status: 'skipped',
        reason: `Unsupported file extension (.${ext}). Supported formats: PDF, DOCX, TXT, MD, PNG, JPG, JPEG, WEBP.`,
      });
      continue;
    }

    // 7. Safe Decompression with Size & Ratio Checks
    let entryBuffer;
    try {
      // Check header uncompressed size if present
      const headerSize = entry.header?.size || 0;
      const compressedSize = entry.header?.compressedSize || 1;

      if (headerSize > limits.MAX_SINGLE_FILE_BYTES) {
        failedFiles.push({
          originalFileName: baseFilename,
          relativePath,
          status: 'failed',
          error: `Uncompressed size exceeds single file limit of ${limits.MAX_SINGLE_FILE_BYTES / (1024 * 1024)} MB.`,
        });
        continue;
      }

      // Check compression ratio (Zip bomb defense)
      if (compressedSize > 0 && headerSize / compressedSize > limits.MAX_COMPRESSION_RATIO) {
        failedFiles.push({
          originalFileName: baseFilename,
          relativePath,
          status: 'failed',
          error: `Excessive compression ratio (${Math.round(headerSize / compressedSize)}:1) rejected as potential decompression bomb.`,
        });
        continue;
      }

      entryBuffer = entry.getData();

      if (!entryBuffer || entryBuffer.length === 0) {
        failedFiles.push({
          originalFileName: baseFilename,
          relativePath,
          status: 'failed',
          error: 'Empty file buffer in archive.',
        });
        continue;
      }

      if (entryBuffer.length > limits.MAX_SINGLE_FILE_BYTES) {
        failedFiles.push({
          originalFileName: baseFilename,
          relativePath,
          status: 'failed',
          error: `Extracted file size (${(entryBuffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds single file limit of ${limits.MAX_SINGLE_FILE_BYTES / (1024 * 1024)} MB.`,
        });
        continue;
      }

      totalExtractedBytes += entryBuffer.length;
      if (totalExtractedBytes > limits.MAX_TOTAL_UNCOMPRESSED_BYTES) {
        throw new Error(
          `Decompressed size exceeded maximum threshold of ${limits.MAX_TOTAL_UNCOMPRESSED_BYTES / (1024 * 1024)} MB.`
        );
      }
    } catch (decompErr) {
      failedFiles.push({
        originalFileName: baseFilename,
        relativePath,
        status: 'failed',
        error: `Decompression error: ${decompErr.message}`,
      });
      continue;
    }

    // 8. Duplicate Handling & Disambiguation
    // Preserve relative path and disambiguate exact duplicate relative paths
    let safeRelativePath = relativePath;
    let safeFilename = baseFilename;

    if (seenPaths.has(relativePath)) {
      const count = seenPaths.get(relativePath) + 1;
      seenPaths.set(relativePath, count);
      const nameParts = baseFilename.split('.');
      const fileExt = nameParts.pop();
      const rawName = nameParts.join('.');
      safeFilename = `${rawName}_dup${count}.${fileExt}`;
      const dir = pathCheck.directory ? `${pathCheck.directory}/` : '';
      safeRelativePath = `${dir}${safeFilename}`;
    } else {
      seenPaths.set(relativePath, 1);
    }

    validFiles.push({
      originalFileName: baseFilename,
      relativePath: safeRelativePath,
      rawRelativePath: relativePath,
      cleanFilename: sanitizeEntryFilename(safeFilename),
      fileType: typeInfo.fileType,
      category: typeInfo.category,
      mimeType: typeInfo.mimeType,
      extension: typeInfo.extension,
      sizeBytes: entryBuffer.length,
      buffer: entryBuffer,
      isImage: typeInfo.isImage,
      status: 'extracted',
      parentZipName: originalZipName,
    });
  }

  const totalDetected = validFiles.length + skippedFiles.length + failedFiles.length;

  return {
    archive: originalZipName,
    totalFiles: totalDetected,
    processed: validFiles.length,
    skipped: skippedFiles.length,
    failed: failedFiles.length,
    files: validFiles,
    skippedFiles,
    failedFiles,
  };
};

export default {
  validateAndExtractZip,
  validateAndNormalizeZipPath,
  hasValidZipSignature,
  detectFileType,
  sanitizeEntryFilename,
  SUPPORTED_EXTENSIONS,
  ZIP_LIMITS,
};
