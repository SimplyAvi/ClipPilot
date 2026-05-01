import { NextResponse } from "next/server";
import { deleteProviderKey, getProviderKey, PROVIDER_NAMES } from "@/lib/provider-keys";

export async function DELETE(_request: Request, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  if (!PROVIDER_NAMES.includes(provider)) {
    return NextResponse.json({ data: null, error: `Unknown provider: ${provider}` }, { status: 400 });
  }

  try {
    const deleted = await deleteProviderKey(provider);
    const stillConfigured = Boolean(await getProviderKey(provider));
    return NextResponse.json({
      data: {
        provider,
        deleted,
        stillConfigured,
        message: stillConfigured
          ? "Saved key removed. This provider is still configured through environment variables."
          : "Provider disconnected.",
      },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not disconnect provider.";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
