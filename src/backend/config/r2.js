import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
const bucketName = (process.env.R2_BUCKET_NAME || 'tracemind-documents').trim();

// Cloudflare R2 S3-Compatible Endpoint
const endpoint = (process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')).trim();

const isPlaceholder = (val) => {
  if (!val) return true;
  const lower = String(val).toLowerCase().trim();
  return (
    lower.startsWith('your_') ||
    lower.includes('placeholder') ||
    lower === 'your-account-id' ||
    lower === 'your-key'
  );
};

export const isR2Configured = () => {
  return Boolean(
    (accountId || endpoint) &&
    !isPlaceholder(accountId) &&
    !isPlaceholder(accessKeyId) &&
    !isPlaceholder(secretAccessKey) &&
    !isPlaceholder(bucketName) &&
    !endpoint.includes('your_cloudflare_account_id')
  );
};

let r2Client = null;

if (isR2Configured()) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });
  console.log(`☁️ Cloudflare R2 Client connected for bucket: "${bucketName}"`);
} else {
  console.warn(
    '⚠️ Cloudflare R2 credentials are not configured or using placeholders in .env. R2 operations will run in local fallback storage mode until real credentials are provided.'
  );
}

export { r2Client, bucketName };
export default r2Client;
