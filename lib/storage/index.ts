import path from "path";
import { db } from "@/lib/db";
import { getProviderKey } from "@/lib/provider-keys";
import { LocalStorageAdapter } from "./local-adapter";
import { R2StorageAdapter, type R2Config } from "./r2-adapter";
import type { StorageAdapter } from "./storage-adapter";

export type { StorageAdapter, StoredFile } from "./storage-adapter";

export function isR2Configured(): boolean {
  return !!(
    (process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID) &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

export async function getR2Config(): Promise<R2Config | null> {
  const envAccountId = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  if (envAccountId && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME) {
    return {
      accountId: envAccountId,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET_NAME,
      publicBaseUrl: process.env.R2_PUBLIC_URL,
    };
  }

  const raw = await getProviderKey("r2").catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string | undefined>;
    const accountId = parsed.R2_ACCOUNT_ID ?? parsed.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = parsed.R2_ACCESS_KEY_ID;
    const secretAccessKey = parsed.R2_SECRET_ACCESS_KEY;
    const bucket = parsed.R2_BUCKET_NAME;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
    return {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicBaseUrl: parsed.R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL,
    };
  } catch {
    return null;
  }
}

export async function isR2ConfiguredAsync(): Promise<boolean> {
  return Boolean(await getR2Config());
}

export async function getLocalStoragePath(): Promise<string> {
  try {
    const setting = await db.storageSetting.findFirst({ orderBy: { updatedAt: "desc" } });
    if (setting?.localRootPath) return setting.localRootPath;
  } catch {
    // During build or early migrations the table may not exist yet.
  }
  return process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), "generated-media");
}

export async function getStorage(): Promise<StorageAdapter> {
  const r2Config = await getR2Config();
  if (r2Config) return new R2StorageAdapter(r2Config);
  const localPath = await getLocalStoragePath();
  if (!localPath) {
    throw new Error(
      "No storage configured. Either set up Cloudflare R2 in Settings -> Storage, or set a local folder path."
    );
  }
  return new LocalStorageAdapter(localPath);
}

export const storage = {
  save: async (...args: Parameters<StorageAdapter["save"]>) => (await getStorage()).save(...args),
  read: async (...args: Parameters<StorageAdapter["read"]>) => (await getStorage()).read(...args),
  delete: async (...args: Parameters<StorageAdapter["delete"]>) => (await getStorage()).delete(...args),
  exists: async (...args: Parameters<StorageAdapter["exists"]>) => (await getStorage()).exists(...args),
  list: async (...args: Parameters<StorageAdapter["list"]>) => (await getStorage()).list(...args),
  getUrl: async (...args: Parameters<StorageAdapter["getUrl"]>) => (await getStorage()).getUrl(...args),
  initProjectFolders: async (...args: Parameters<StorageAdapter["initProjectFolders"]>) =>
    (await getStorage()).initProjectFolders(...args),
  getProjectSize: async (...args: Parameters<StorageAdapter["getProjectSize"]>) =>
    (await getStorage()).getProjectSize(...args),
  backend: () => (isR2Configured() ? "r2" : "local") as "local" | "r2",
};

// Legacy compatibility helpers. New code should prefer `storage.*`.
export function shotVideoKey(projectId: string, sceneId: string, shotId: string) {
  return `projects/${projectId}/scenes/${sceneId}/shots/${shotId}/video.mp4`;
}

export function shotThumbnailKey(projectId: string, sceneId: string, shotId: string) {
  return `projects/${projectId}/scenes/${sceneId}/shots/${shotId}/thumb.jpg`;
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const stored = await storage.save(key, body, contentType);
  return stored.path;
}

export async function downloadFromR2(key: string): Promise<Buffer> {
  return storage.read(key);
}

export async function getSignedViewUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
  const adapter = await getStorage();
  if (adapter instanceof R2StorageAdapter && !process.env.R2_PUBLIC_URL) {
    if (await adapter.exists(key)) {
      return adapter.getSignedUrl(key, _expiresInSeconds);
    }
    const local = new LocalStorageAdapter(await getLocalStoragePath());
    if (await local.exists(key)) {
      return local.getUrl(key);
    }
    return adapter.getSignedUrl(key, _expiresInSeconds);
  }
  return adapter.getUrl(key);
}

export async function deleteFromR2(key: string): Promise<void> {
  await storage.delete(key);
}
