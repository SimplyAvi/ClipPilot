import { getLocalStoragePath, getR2Config } from "@/lib/storage";
import { LocalStorageAdapter } from "@/lib/storage/local-adapter";
import { R2StorageAdapter } from "@/lib/storage/r2-adapter";

export async function ensureR2ObjectFromLocal(
  relativePath: string,
  metadata: Record<string, string> = {}
): Promise<{ copied: boolean; available: boolean }> {
  const r2Config = await getR2Config();
  if (!r2Config) return { copied: false, available: false };

  const r2 = new R2StorageAdapter(r2Config);
  if (await r2.exists(relativePath)) return { copied: false, available: true };

  const local = new LocalStorageAdapter(await getLocalStoragePath());
  if (!(await local.exists(relativePath))) return { copied: false, available: false };

  const data = await local.read(relativePath);
  await r2.save(relativePath, data, mimeFromPath(relativePath), {
    migratedFrom: "local",
    migrationMode: "on-demand",
    ...metadata,
  });

  return { copied: true, available: true };
}

function mimeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return (
    {
      mp4: "video/mp4",
      wav: "audio/wav",
      mp3: "audio/mpeg",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      json: "application/json",
    }[ext ?? ""] ?? "application/octet-stream"
  );
}
