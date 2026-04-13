import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ data: null, error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "pdf") {
    return NextResponse.json(
      { data: null, error: "Only PDF files are supported by this endpoint" },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { data: null, error: "PDF file must be under 5 MB" },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamic import avoids Next.js webpack issues with pdf-parse at build time.
    // The ESM wrapper for pdf-parse exports the function directly (not via .default).
    type PdfParseFn = (buf: Buffer) => Promise<{ text: string; numpages: number }>;
    const pdfParse = (await import("pdf-parse")) as unknown as PdfParseFn;
    const result = await pdfParse(buffer);

    if (!result.text.trim()) {
      return NextResponse.json(
        { data: null, error: "Could not extract text from this PDF. It may be scanned or image-based. Please paste the script text manually." },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: { text: result.text }, error: null });
  } catch (err) {
    console.error("[extract-text] PDF parse error:", err);
    return NextResponse.json(
      { data: null, error: "Failed to parse PDF. Please paste your script text manually." },
      { status: 500 }
    );
  }
}
