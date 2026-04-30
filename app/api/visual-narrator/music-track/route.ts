import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({
  projectId: z.string().min(1),
  mood: z.string().nullable().optional(),
  tempo: z.string().nullable().optional(),
  style: z.string().nullable().optional(),
  primaryInstrument: z.string().nullable().optional(),
  silenceUsage: z.string().nullable().optional(),
  emotionalArc: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }
  const { projectId, ...data } = parsed.data;
  const track = await db.projectMusicTrack.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });
  return NextResponse.json({ data: track, error: null });
}
