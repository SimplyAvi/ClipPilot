import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const project = await db.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });

  await db.generationJob.updateMany({
    where: { projectId: params.id, status: { in: ["queued", "running", "paused"] } },
    data: {
      status: "cancelled",
      completedAt: new Date(),
      currentStageLabel: "Runway generation cancelled",
    },
  });

  await db.runwayClip.updateMany({
    where: {
      projectId: params.id,
      status: { in: ["queued", "submitting", "generating", "downloading", "muxing", "pending"] },
    },
    data: {
      status: "failed",
      errorMessage: "Cancelled by user.",
    },
  });

  return NextResponse.json({ data: { status: "cancelled" }, error: null });
}

