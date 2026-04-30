import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { appendLog } from "@/lib/generation/job-manager";

const BodySchema = z.object({ taskId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  const job = await db.generationJob.findUnique({ where: { projectId: params.projectId } });
  if (!job) return NextResponse.json({ data: null, error: "Generation job not found" }, { status: 404 });
  const task = await db.generationTask.update({
    where: { id: parsed.data.taskId },
    data: { status: "pending", progress: 0, errorMessage: null, retryCount: { increment: 1 } },
  });
  await appendLog(job.id, "warning", `Retry queued: ${task.label}`, task.id);
  return NextResponse.json({ data: task, error: null });
}
