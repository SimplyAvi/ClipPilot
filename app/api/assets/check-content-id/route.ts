import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const AUDD_API_URL = "https://api.audd.io/";
const MAX_FILE_SIZE_MB = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuddTrack {
  artist: string;
  title: string;
  album?: string;
  release_date?: string;
  label?: string;
  timecode?: string;
  song_link?: string;
}

interface AuddResponse {
  status: "success" | "error";
  result: AuddTrack | null;
  error?: { error_code: number; error_message: string };
}

export interface ContentIdCheckResult {
  recognized: boolean;
  clear: boolean; // true = passed pre-check, false = do not use
  track: AuddTrack | null;
  message: string;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * POST /api/assets/check-content-id
 *
 * Accepts multipart/form-data:
 *   - file:    audio file (mp3 / wav / m4a — max 10 MB)
 *   - assetId: (optional) if provided, updates the asset record in the DB
 */
export async function POST(request: Request) {
  if (!process.env.AUDD_API_KEY) {
    return NextResponse.json(
      { data: null, error: "AUDD_API_KEY is not configured. Add it to your .env file." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const assetId = formData.get("assetId") as string | null;

  if (!file) {
    return NextResponse.json({ data: null, error: "No audio file provided" }, { status: 400 });
  }

  const validTypes = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a", "audio/ogg"];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg)$/i)) {
    return NextResponse.json(
      { data: null, error: "Unsupported file type. Upload an MP3, WAV, M4A, or OGG file." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { data: null, error: `Audio file must be under ${MAX_FILE_SIZE_MB} MB` },
      { status: 400 }
    );
  }

  // ── Call AudD API ─────────────────────────────────────────────────────────
  let auddResponse: AuddResponse;
  try {
    const auddForm = new FormData();
    auddForm.append("api_token", process.env.AUDD_API_KEY);
    auddForm.append("file", file);
    auddForm.append("return", "apple_music,spotify"); // extra metadata if available

    const res = await fetch(AUDD_API_URL, { method: "POST", body: auddForm });
    auddResponse = (await res.json()) as AuddResponse;
  } catch (err) {
    console.error("[check-content-id] AudD fetch error:", err);
    return NextResponse.json(
      { data: null, error: "Failed to reach AudD API. Check your network and API key." },
      { status: 502 }
    );
  }

  if (auddResponse.status === "error") {
    const msg = auddResponse.error?.error_message ?? "AudD API error";
    return NextResponse.json({ data: null, error: msg }, { status: 502 });
  }

  // ── Interpret result ──────────────────────────────────────────────────────
  const recognized = auddResponse.result !== null;
  const result: ContentIdCheckResult = recognized
    ? {
        recognized: true,
        clear: false,
        track: auddResponse.result,
        message: `Track identified: "${auddResponse.result!.title}" by ${auddResponse.result!.artist}. High Content ID risk — do not use.`,
      }
    : {
        recognized: false,
        clear: true,
        track: null,
        message: "Track not identified in AudD database. Passed Content ID pre-check.",
      };

  // ── Update asset record if assetId provided ───────────────────────────────
  if (assetId) {
    try {
      await db.asset.update({
        where: { id: assetId },
        data: {
          contentIdChecked: true,
          contentIdClear: result.clear,
          notes: result.message,
        },
      });
    } catch (err) {
      console.error("[check-content-id] DB update error:", err);
      // Don't fail the response — the check result is still valid
    }
  }

  return NextResponse.json({ data: result, error: null });
}
