import { NextResponse } from "next/server";
import { getSignedViewUrl } from "@/lib/storage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) {
    return NextResponse.json({ data: null, error: "key is required" }, { status: 400 });
  }

  try {
    const url = await getSignedViewUrl(key);
    return NextResponse.redirect(new URL(url, request.url));
  } catch (err) {
    console.error("[GET /api/storage/view]", err);
    return NextResponse.json({ data: null, error: "File not found" }, { status: 404 });
  }
}
