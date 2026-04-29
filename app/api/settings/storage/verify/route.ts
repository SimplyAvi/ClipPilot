import fs from "fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import checkDiskSpace from "check-disk-space";

const VerifySchema = z.object({ path: z.string().min(1) });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const target = parsed.data.path;
  const exists = fs.existsSync(target);
  let writable = false;
  let freeSpaceGB = 0;
  let error: string | undefined;

  if (!exists) {
    error = "Path not found - check the folder exists";
  } else {
    try {
      fs.accessSync(target, fs.constants.W_OK);
      writable = true;
    } catch {
      error = "Permission denied - folder is not writable";
    }
  }

  if (exists) {
    try {
      const disk = await checkDiskSpace(target);
      freeSpaceGB = Math.round((disk.free / 1024 / 1024 / 1024) * 10) / 10;
    } catch {
      // Disk-space checks are best-effort.
    }
  }

  return NextResponse.json({
    data: {
      valid: exists && writable,
      exists,
      writable,
      freeSpaceGB,
      error,
    },
    error: null,
  });
}
