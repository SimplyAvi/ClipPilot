/**
 * Worker entry point — run this process separately from Next.js.
 * Usage: node_modules/.bin/ts-node --project tsconfig.workers.json workers/index.ts
 */
import { startScriptParseWorker } from "./script-parse.worker";
import { startSceneGenerationWorker } from "./scene-generation.worker";
import { startRunwayGenerationWorker } from "@/lib/runway/generation-worker";

const workers = [
  startScriptParseWorker(),
  startSceneGenerationWorker(),
  startRunwayGenerationWorker(),
];

console.log(`[workers] Started ${workers.length} worker(s)`);

async function shutdown(signal: string) {
  console.log(`[workers] ${signal} received — shutting down gracefully`);
  await Promise.all(workers.map((w) => w.close()));
  console.log("[workers] All workers closed");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
