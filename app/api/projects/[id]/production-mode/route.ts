import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({
  productionMode: z.enum(["character_driven", "visual_only", "mixed", "visual_narrator"]),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

  try {
    const project = await db.project.update({
      where: { id: params.id },
      data: { productionMode: parsed.data.productionMode },
    });
    return NextResponse.json({ data: project, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });
  }
}
