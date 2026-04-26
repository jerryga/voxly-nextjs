import "dotenv/config";
import { Storage } from "@google-cloud/storage";

const REQUIRED_ENV = {
  BUCKET: ["GCS_BUCKET", "S3_BUCKET_NAME", "S3_BUCKET"],
};

let cachedStorage = null;
const bucketCache = new Map();

function getStorage() {
  cachedStorage ??= new Storage();
  return cachedStorage;
}

function resolveBucketName(override) {
  if (override) return override;
  for (const name of REQUIRED_ENV.BUCKET) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    `Missing required env var: ${REQUIRED_ENV.BUCKET.join(" or ")}`,
  );
}

function getBucket(override) {
  const name = resolveBucketName(override);
  let bucket = bucketCache.get(name);
  if (!bucket) {
    bucket = getStorage().bucket(name);
    bucketCache.set(name, bucket);
  }
  return bucket;
}

/**
 * Uploads content to object storage.
 * @param {{ bucket?: string; key: string; body: Buffer | Uint8Array | string | NodeJS.ReadableStream; contentType?: string; cacheControl?: string; }} params
 * @returns {Promise<{ bucket: string; key: string }>}
 */
export async function uploadToS3({
  bucket,
  key,
  body,
  contentType,
  cacheControl,
}) {
  if (!key) throw new Error("uploadToS3 requires a key");
  if (body === undefined || body === null) {
    throw new Error("uploadToS3 requires a body");
  }

  const target = getBucket(bucket);
  const file = target.file(key);

  await file.save(body, {
    contentType,
    metadata: cacheControl ? { cacheControl } : undefined,
    resumable: false,
  });

  return { bucket: target.name, key };
}

/**
 * Returns a v4 signed URL valid for `expiresIn` seconds.
 */
export async function getSignedFileUrl({ bucket, key, expiresIn = 900 }) {
  if (!key) throw new Error("getSignedFileUrl requires a key");
  const target = getBucket(bucket);
  const [url] = await target.file(key).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresIn * 1000,
  });
  return url;
}

/**
 * Deletes an object from storage. Missing keys are treated as success.
 * @param {{ bucket?: string; key: string; }} params
 * @returns {Promise<void>}
 */
export async function deleteFromS3({ bucket, key }) {
  if (!key) throw new Error("deleteFromS3 requires a key");
  const target = getBucket(bucket);
  await target.file(key).delete({ ignoreNotFound: true });
}
