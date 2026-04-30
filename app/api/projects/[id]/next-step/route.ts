import { NextResponse } from "next/server";
import { calculateNextStep } from "@/lib/projects/next-step-calculator";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url);
  const skippedSteps = (searchParams.get("skip") ?? "")
    .split(",")
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scripts: true,
      scenes: {
        include: {
          shots: true,
          previews: true,
        },
      },
      visualSegments: {
        include: {
          previews: true,
        },
      },
      projectCharacters: { include: { character: true } },
      theme: true,
      generationJob: true,
      narratorProfile: true,
      projectMusicTrack: true,
      transcription: true,
      thumbnails: true,
      exports: true,
      posts: true,
    },
  });

  if (!project) return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });

  const nextStep = calculateNextStep(project, skippedSteps);
  return NextResponse.json({ data: nextStep, error: null });
}
