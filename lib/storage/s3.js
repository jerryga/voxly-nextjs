import "dotenv/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const clientCache = new Map();

const REQUIRED_ENV = {
  REGION: ["S3_REGION", "AWS_REGION", "AWS_DEFAULT_REGION"],
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

function getConfiguredRegion() {
  return (
    process.env.S3_REGION ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    ensureEnv(REQUIRED_ENV.REGION)
  );
}

function getS3Client(region = getConfiguredRegion()) {
  const cacheKey = region;
  const cachedClient = clientCache.get(cacheKey);
  if (cachedClient) return cachedClient;

  // Let AWS SDK resolve credentials from env/IMDS/default providers automatically.
  const client = new S3Client({ region });
  clientCache.set(cacheKey, client);
  return client;
}

function getRegionFromS3Error(err) {
  if (!err || typeof err !== "object") {
    return null;
  }

  const endpoint = typeof err.Endpoint === "string" ? err.Endpoint : "";
  const endpointMatch = endpoint.match(/\.s3[.-]([a-z0-9-]+)\.amazonaws\.com$/i);
  if (endpointMatch?.[1]) {
    return endpointMatch[1];
  }

  const bucketRegion =
    typeof err.BucketRegion === "string"
      ? err.BucketRegion
      : typeof err?.$response?.headers?.["x-amz-bucket-region"] === "string"
        ? err.$response.headers["x-amz-bucket-region"]
        : null;

  return bucketRegion || null;
}

async function sendWithRegionRedirectRetry(command, operationName) {
  const initialRegion = getConfiguredRegion();
  try {
    return await getS3Client(initialRegion).send(command);
  } catch (err) {
    const shouldRetry =
      err?.Code === "PermanentRedirect" ||
      err?.name === "PermanentRedirect" ||
      err?.$metadata?.httpStatusCode === 301;
    const redirectedRegion = getRegionFromS3Error(err);

    if (
      shouldRetry &&
      redirectedRegion &&
      redirectedRegion !== initialRegion
    ) {
      console.warn(
        `${operationName} retried with bucket region ${redirectedRegion} after S3 redirect from ${initialRegion}`,
      );
      return getS3Client(redirectedRegion).send(command);
    }

    throw err;
  }
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

  const command = new PutObjectCommand({
    Bucket: resolvedBucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  const output = await sendWithRegionRedirectRetry(command, "uploadToS3");

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

/**
 * Deletes content from S3.
 * @param {{ bucket?: string; key: string; }} params
 * @returns {Promise<void>}
 */
export async function deleteFromS3({ bucket, key }) {
  if (!key) throw new Error("deleteFromS3 requires a key");

  const resolvedBucket =
    bucket ??
    process.env.S3_BUCKET_NAME ??
    process.env.S3_BUCKET ??
    ensureEnv(REQUIRED_ENV.BUCKET);
  await sendWithRegionRedirectRetry(
    new DeleteObjectCommand({
      Bucket: resolvedBucket,
      Key: key,
    }),
    "deleteFromS3",
  );
}
