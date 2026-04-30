import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const PatchSchema = z.object({
  approved: z.boolean().optional(),
  feedback: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const preview = await db.scenePreview.update({
    where: { id: params.id },
    data: {
      approvedAt: parsed.data.approved ? new Date() : null,
      feedback: parsed.data.feedback,
    },
  });

  return NextResponse.json({ data: preview, error: null });
}
