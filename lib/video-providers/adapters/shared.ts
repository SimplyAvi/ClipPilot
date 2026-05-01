import { storage } from "@/lib/storage";

export async function downloadToStorage(outputUrl: string, destPath: string, provider: string): Promise<void> {
  const res = await fetch(outputUrl);
  if (!res.ok) throw new Error(`Failed to download ${provider} output: ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await storage.save(destPath, buffer, "video/mp4", { provider });
}

export function authError(provider: string): Error {
  return new Error(`${provider} API key not configured. Add it in Settings -> AI Providers.`);
}

