/**
 * POST /api/settings/save-key
 *
 * Accepts { provider, key } and persists an encrypted copy to the ProviderKey table.
 * For R2 (which has 4 separate credentials), the client passes a JSON string
 * containing all four values: { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ... }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { saveProviderKey, PROVIDER_NAMES } from "@/lib/provider-keys";

const SaveSchema = z.object({
  provider: z.string().min(1),
  key: z.string().min(1, "Key cannot be empty"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { provider, key } = parsed.data;

  if (!PROVIDER_NAMES.includes(provider)) {
    return NextResponse.json(
      { success: false, error: `Unknown provider: ${provider}` },
      { status: 400 }
    );
  }

  try {
    await saveProviderKey(provider, key);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[save-key]", message);
    // If ENCRYPTION_SECRET is missing, give the user a clear message
    if (message.includes("ENCRYPTION_SECRET")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ENCRYPTION_SECRET is not configured. Add it to your .env.local file — " +
            "see .env.example for instructions.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to save key — is the database running?" },
      { status: 500 }
    );
  }
}
