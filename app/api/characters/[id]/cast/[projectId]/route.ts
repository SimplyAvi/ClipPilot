import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; projectId: string } }
) {
  try {
    await db.projectCharacter.delete({
      where: {
        characterId_projectId: {
          characterId: params.id,
          projectId: params.projectId,
        },
      },
    });
    return NextResponse.json({ data: { removed: true }, error: null });
  } catch (err) {
    console.error("[DELETE /api/characters/[id]/cast/[projectId]]", err);
    return NextResponse.json({ data: null, error: "Cast assignment not found" }, { status: 404 });
  }
}
