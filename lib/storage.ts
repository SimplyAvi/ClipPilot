/**
 * Cloudflare R2 storage client (S3-compatible).
 * All generated video and thumbnail files are stored here.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── Client ───────────────────────────────────────────────────────────────────

function createR2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    // Return a stub client in dev — upload calls will throw with a clear message
    console.warn("[storage] R2 credentials not configured — uploads will fail");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId ?? "missing"}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId ?? "missing",
      secretAccessKey: secretAccessKey ?? "missing",
    },
  });
}

const globalForR2 = globalThis as unknown as { r2: S3Client | undefined };
export const r2 = globalForR2.r2 ?? createR2Client();
if (process.env.NODE_ENV !== "production") globalForR2.r2 = r2;

const BUCKET = process.env.R2_BUCKET_NAME ?? "clippilot";

// ─── Path helpers ─────────────────────────────────────────────────────────────

export function shotVideoKey(projectId: string, sceneId: string, shotId: string) {
  return `projects/${projectId}/scenes/${sceneId}/shots/${shotId}/video.mp4`;
}

export function shotThumbnailKey(projectId: string, sceneId: string, shotId: string) {
  return `projects/${projectId}/scenes/${sceneId}/shots/${shotId}/thumb.jpg`;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload a Buffer to R2.
 * Returns the object key (used as the path stored in the DB).
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Download an R2 object as a Buffer.
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
  const response = await r2.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  if (!response.Body) throw new Error(`R2 object not found: ${key}`);

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ─── Signed URL ───────────────────────────────────────────────────────────────

/**
 * Generate a short-lived signed URL for in-browser preview.
 * Default expiry: 1 hour.
 */
export async function getSignedViewUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
