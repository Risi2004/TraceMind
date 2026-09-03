import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { r2Client, bucketName, isR2Configured } from '../config/r2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_STORAGE_DIR = path.resolve(__dirname, '../../uploads_local');

// Ensure local fallback storage exists
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

/**
 * Upload a binary buffer to Cloudflare R2 bucket (or local storage fallback)
 */
export const uploadBufferToR2 = async ({
  key,
  buffer,
  contentType = 'application/octet-stream',
  metadata = {},
}) => {
  if (isR2Configured() && r2Client) {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    });

    await r2Client.send(command);
    return {
      storage: 'r2',
      bucket: bucketName,
      key,
    };
  } else {
    // Local development fallback
    const localFilePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'));
    await fs.promises.writeFile(localFilePath, buffer);
    return {
      storage: 'local_fallback',
      bucket: 'local-dev',
      key,
      localPath: localFilePath,
    };
  }
};

/**
 * Generate a secure, time-limited presigned URL to view/download a private document
 */
export const getPresignedR2ViewUrl = async ({
  key,
  expiresInSeconds = 900, // 15 minutes default
}) => {
  if (isR2Configured() && r2Client) {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: expiresInSeconds,
    });

    return presignedUrl;
  } else {
    // Local fallback direct streaming endpoint
    return `/api/documents/stream/${encodeURIComponent(key)}`;
  }
};

/**
 * Delete an object from Cloudflare R2
 */
export const deleteFileFromR2 = async ({ key }) => {
  if (isR2Configured() && r2Client) {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await r2Client.send(command);
    return true;
  } else {
    const localFilePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'));
    if (fs.existsSync(localFilePath)) {
      await fs.promises.unlink(localFilePath).catch(() => {});
    }
    return true;
  }
};

/**
 * Check if a file exists in R2
 */
export const checkFileExistsInR2 = async ({ key }) => {
  if (isR2Configured() && r2Client) {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      });
      await r2Client.send(command);
      return true;
    } catch {
      return false;
    }
  } else {
    const localFilePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'));
    return fs.existsSync(localFilePath);
  }
};

/**
 * Read object as Buffer from Cloudflare R2
 */
export const getObjectBufferFromR2 = async ({ key }) => {
  if (isR2Configured() && r2Client) {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const response = await r2Client.send(command);
    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  } else {
    return getLocalFallbackBuffer(key);
  }
};

/**
 * Read local fallback buffer if needed
 */
export const getLocalFallbackBuffer = async (key) => {
  const localFilePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'));
  if (fs.existsSync(localFilePath)) {
    return fs.promises.readFile(localFilePath);
  }
  return null;
};

