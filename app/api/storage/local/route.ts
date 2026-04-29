import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getLocalStoragePath } from "@/lib/storage";
import { mimeFromPath } from "@/lib/storage/file-tree";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get("path");
  if (!rawPath) {
    return NextResponse.json({ data: null, error: "path is required" }, { status: 400 });
  }

  const decoded = decodeURIComponent(rawPath);
  const root = path.resolve(await getLocalStoragePath());
  const fullPath = path.resolve(root, decoded);

  if (!fullPath.startsWith(root)) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }
  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ data: null, error: "File not found" }, { status: 404 });
  }

  const file = fs.readFileSync(fullPath);
  return new Response(file, {
    headers: {
      "Content-Type": mimeFromPath(fullPath),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
