import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({
  projectId: z.string().min(1),
  voiceId: z.string().nullable().optional(),
  voiceName: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  pace: z.string().optional(),
  tone: z.string().nullable().optional(),
  emotionalRange: z.string().optional(),
  deliveryStyle: z.string().nullable().optional(),
  pauseSeconds: z.number().min(0).max(5).optional(),
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
  const profile = await db.narratorProfile.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });
  return NextResponse.json({ data: profile, error: null });
}
