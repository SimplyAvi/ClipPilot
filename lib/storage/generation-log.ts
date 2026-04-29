import { storage } from "@/lib/storage";
import { generationLogPath } from "./naming";

export type GenerationLogEntry = {
  timestamp: string;
  type: "video" | "dialogue" | "music" | "image" | "caption" | "export";
  provider: string;
  model: string;
  inputPath?: string;
  outputPath: string;
  durationSeconds?: number;
  cost: number;
  status: "success" | "failed";
  error?: string;
};

export async function appendGenerationLog(
  projectSlug: string,
  entry: GenerationLogEntry
): Promise<void> {
  const path = generationLogPath(projectSlug);
  let entries: GenerationLogEntry[] = [];

  if (await storage.exists(path)) {
    try {
      entries = JSON.parse((await storage.read(path)).toString("utf-8"));
      if (!Array.isArray(entries)) entries = [];
    } catch {
      entries = [];
    }
  }

  entries.push(entry);
  await storage.save(path, Buffer.from(JSON.stringify(entries, null, 2)), "application/json", {
    projectSlug,
    type: "generation-log",
  });
}
