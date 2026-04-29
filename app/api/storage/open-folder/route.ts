import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getLocalStoragePath } from "@/lib/storage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project");
  if (!project) {
    return NextResponse.json({ data: null, error: "project is required" }, { status: 400 });
  }

  const root = path.resolve(await getLocalStoragePath());
  const projectFolderPath = path.resolve(root, project);
  if (!projectFolderPath.startsWith(root)) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  fs.mkdirSync(projectFolderPath, { recursive: true });
  const open = (await import("open")).default;
  await open(projectFolderPath);
  return NextResponse.json({ data: { success: true }, error: null });
}
