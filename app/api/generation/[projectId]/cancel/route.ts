import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sceneGenerateQueue } from "@/lib/queues";
import { cancelJob } from "@/lib/generation/job-manager";

export async function POST(_request: Request, { params }: { params: { projectId: string } }) {
  const job = await db.generationJob.findUnique({ where: { projectId: params.projectId } });
  if (!job) return NextResponse.json({ data: null, error: "Generation job not found" }, { status: 404 });
  await cancelJob(job.id);
  const jobs = await sceneGenerateQueue.getJobs(["waiting", "delayed", "paused"]);
  await Promise.all(jobs.filter((item) => item.data?.projectId === params.projectId).map((item) => item.remove().catch(() => undefined)));
  return NextResponse.json({ data: { status: "cancelled" }, error: null });
}
