import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getLocalStoragePath } from "@/lib/storage";
import { mimeFromPath } from "@/lib/storage/file-tree";

export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const relativePath = params.path.join("/");
  const root = path.resolve(await getLocalStoragePath());
  const fullPath = path.resolve(root, relativePath);

  if (!fullPath.startsWith(root)) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }
  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ data: null, error: "File not found" }, { status: 404 });
  }

  return new Response(fs.readFileSync(fullPath), {
    headers: {
      "Content-Type": mimeFromPath(fullPath),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
