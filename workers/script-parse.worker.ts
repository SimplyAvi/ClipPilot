import { Worker, Job } from "bullmq";
import { redisConfig } from "@/lib/redis";
import { db } from "@/lib/db";

interface ScriptParseJobData {
  projectId: string;
  scriptId: string;
  jobId: string;
}

async function processScriptParse(job: Job<ScriptParseJobData>) {
  const { projectId, scriptId, jobId } = job.data;

  await db.job.update({
    where: { id: jobId },
    data: { status: "PROCESSING", progress: 0 },
  });

  // TODO Phase 2: call Claude API to parse script into scenes/shots
  console.log(`[script-parse] Processing script ${scriptId} for project ${projectId}`);

  await job.updateProgress(100);

  await db.job.update({
    where: { id: jobId },
    data: { status: "COMPLETE", progress: 100 },
  });
}

export function startScriptParseWorker() {
  const worker = new Worker<ScriptParseJobData>("script-parse", processScriptParse, {
    connection: redisConfig,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[script-parse] Job ${job.id} completed`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[script-parse] Job ${job?.id} failed:`, err.message);
    if (job?.data.jobId) {
      await db.job.update({
        where: { id: job.data.jobId },
        data: { status: "FAILED", error: err.message },
      });
    }
  });

  return worker;
}
