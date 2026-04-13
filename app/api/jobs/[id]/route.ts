/**
 * GET  /api/jobs/[id]  — fetch job status + shots
 * POST /api/jobs/[id]  — control: pause | resume | cancel
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const ControlSchema = z.object({
  action: z.enum(["pause", "resume", "cancel"]),
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const job = await db.job.findUnique({ where: { id: params.id } });
    if (!job) {
      return NextResponse.json({ data: null, error: "Job not found" }, { status: 404 });
    }

    const scenes = await db.scene.findMany({
      where: { projectId: job.projectId },
      include: { shots: { orderBy: { shotNumber: "asc" } } },
      orderBy: { sceneNumber: "asc" },
    });

    return NextResponse.json({ data: { job, scenes }, error: null });
  } catch (err) {
    console.error("[GET /api/jobs/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch job" }, { status: 500 });
  }
}

// ─── POST (control) ───────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ControlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { action } = parsed.data;

  try {
    const job = await db.job.findUnique({ where: { id: params.id } });
    if (!job) {
      return NextResponse.json({ data: null, error: "Job not found" }, { status: 404 });
    }

    // Validate state transitions
    const allowedFrom: Record<string, string[]> = {
      pause: ["PROCESSING", "PENDING"],
      resume: ["PAUSED"],
      cancel: ["PENDING", "PROCESSING", "PAUSED"],
    };

    if (!allowedFrom[action].includes(job.status)) {
      return NextResponse.json(
        { data: null, error: `Cannot ${action} a job with status ${job.status}` },
        { status: 409 }
      );
    }

    const newStatus = action === "pause" ? "PAUSED" : action === "resume" ? "PROCESSING" : "CANCELLED";

    const updated = await db.job.update({
      where: { id: params.id },
      data: { status: newStatus },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (err) {
    console.error("[POST /api/jobs/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to update job" }, { status: 500 });
  }
}
