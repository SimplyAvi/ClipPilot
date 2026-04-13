/**
 * /api/settings/keys
 *
 * GET  — Returns { [key]: boolean } indicating which keys are set (DB or env).
 * POST — Saves { key: string, value: string } to the AppSetting table.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSetting, setSetting, getSettingsStatus } from "@/lib/app-settings";
import { ENV_KEYS } from "@/lib/env-status";

export async function GET() {
  const status = await getSettingsStatus(ENV_KEYS);
  return NextResponse.json({ data: status, error: null });
}

const SaveSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  // Only allow saving known keys
  if (!ENV_KEYS.includes(parsed.data.key as typeof ENV_KEYS[number])) {
    return NextResponse.json(
      { data: null, error: "Unknown setting key" },
      { status: 400 }
    );
  }

  try {
    await setSetting(parsed.data.key, parsed.data.value);
    const isSet = Boolean(await getSetting(parsed.data.key));
    return NextResponse.json({ data: { key: parsed.data.key, isSet }, error: null });
  } catch (err) {
    console.error("[settings/keys] save error:", err);
    return NextResponse.json(
      { data: null, error: "Failed to save — is the database running?" },
      { status: 500 }
    );
  }
}
