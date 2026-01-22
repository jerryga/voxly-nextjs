import "dotenv/config";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let cachedClient;

const REQUIRED_ENV = {
  REGION: ["AWS_REGION", "AWS_DEFAULT_REGION"],
  BUCKET: ["S3_BUCKET_NAME", "S3_BUCKET"],
};

function ensureEnv(nameOrNames) {
  if (Array.isArray(nameOrNames)) {
    for (const envName of nameOrNames) {
      if (process.env[envName]) {
        return process.env[envName];
      }
    }
    throw new Error(`Missing required env var: ${nameOrNames.join(" or ")}`);
  }

  const value = process.env[nameOrNames];
  if (!value) throw new Error(`Missing required env var: ${nameOrNames}`);
  return value;
}

function getS3Client() {
  if (cachedClient) return cachedClient;
  const region =
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    ensureEnv(REQUIRED_ENV.REGION);

  // Let AWS SDK resolve credentials from env/IMDS/default providers automatically.
  cachedClient = new S3Client({ region });
  return cachedClient;
}

/**
 * Uploads content to S3.
 * @param {{ bucket?: string; key: string; body: Buffer | Uint8Array | string | NodeJS.ReadableStream; contentType?: string; cacheControl?: string; }} params
 * @returns {Promise<{ bucket: string; key: string; etag?: string | undefined }>}
 */
export async function uploadToS3({
  bucket,
  key,
  body,
  contentType,
  cacheControl,
}) {
  if (!key) throw new Error("uploadToS3 requires a key");
  if (!body) throw new Error("uploadToS3 requires a body");

  const resolvedBucket =
    bucket ??
    process.env.S3_BUCKET_NAME ??
    process.env.S3_BUCKET ??
    ensureEnv(REQUIRED_ENV.BUCKET);
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: resolvedBucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  const output = await client.send(command);

  return {
    bucket: resolvedBucket,
    key,
    etag: output.ETag,
  };
}

export async function getSignedFileUrl({ bucket, key, expiresIn = 900 }) {
  if (!key) throw new Error("getSignedFileUrl requires a key");
  const resolvedBucket =
    bucket ??
    process.env.S3_BUCKET_NAME ??
    process.env.S3_BUCKET ??
    ensureEnv(REQUIRED_ENV.BUCKET);
  const client = getS3Client();
  const command = new GetObjectCommand({ Bucket: resolvedBucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}
