import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pauseJob } from "@/lib/generation/job-manager";

export async function POST(_request: Request, { params }: { params: { projectId: string } }) {
  const job = await db.generationJob.findUnique({ where: { projectId: params.projectId } });
  if (!job) return NextResponse.json({ data: null, error: "Generation job not found" }, { status: 404 });
  await pauseJob(job.id);
  return NextResponse.json({ data: { status: "pausing" }, error: null });
}
