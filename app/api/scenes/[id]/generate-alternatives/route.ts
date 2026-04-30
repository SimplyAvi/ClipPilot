import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSignedViewUrl } from "@/lib/storage";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const scene = await db.scene.findUnique({
    where: { id: params.id },
    include: { shots: { orderBy: { shotNumber: "asc" } } },
  });

  if (!scene) return NextResponse.json({ data: null, error: "Scene not found" }, { status: 404 });

  const assembledVariants = [scene.assembledPath].filter(Boolean) as string[];
  if (assembledVariants.length === 0) {
    const shotVariants = scene.shots.flatMap((shot) => parseVariantPaths(shot.variantPaths, shot.generatedVideoPath));
    if (shotVariants.length === 0) {
      return NextResponse.json(
        { data: null, error: "Generate shots or assemble the scene before creating scene alternatives." },
        { status: 422 }
      );
    }
    const urls = await Promise.all(shotVariants.slice(0, 3).map((path) => getSignedViewUrl(path).catch(() => path)));
    return NextResponse.json({
      data: { variants: urls, message: "Showing available shot variants until scene assembly alternatives are generated." },
      error: null,
    });
  }

  const urls = await Promise.all(assembledVariants.map((path) => getSignedViewUrl(path).catch(() => path)));
  return NextResponse.json({ data: { variants: urls }, error: null });
}

function parseVariantPaths(raw: string | null, fallback: string | null): string[] {
  if (!raw) return fallback ? [fallback] : [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return fallback ? [fallback] : [];
  }
}
