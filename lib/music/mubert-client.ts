import { getProviderKey } from "@/lib/provider-keys";

const MUBERT_API_BASE = "https://music-api.mubert.com/api/v3/public";
const MUBERT_SERVICE_BASE = "https://music-api.mubert.com/api/v3/service";
const DEFAULT_CUSTOM_ID = "clippilot-local";

type MubertCredentials = {
  customerId: string;
  accessToken: string;
};

type MubertServiceCredentials = {
  companyId: string;
  licenseToken: string;
};

type MubertGeneration = {
  status: string;
  url: string | null;
  format?: string | null;
};

type MubertTrack = {
  id: string;
  duration?: number | null;
  generations?: MubertGeneration[];
};

export type GeneratedMubertTrack = {
  trackId: string;
  url: string;
  durationSeconds: number;
  mimeType: string;
  extension: "mp3" | "wav";
};

export async function getMubertCredentials(): Promise<MubertCredentials | null> {
  try {
    return await resolveMubertCredentials();
  } catch {
    return null;
  }
}

export async function resolveMubertCredentials(): Promise<MubertCredentials | null> {
  const raw = await getProviderKey("mubert");
  if (!raw) return null;

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }

  const customerId = parsed.MUBERT_CUSTOMER_ID?.trim();
  const accessToken = parsed.MUBERT_ACCESS_TOKEN?.trim();
  if (customerId && accessToken) return { customerId, accessToken };

  const companyId = parsed.MUBERT_COMPANY_ID?.trim();
  const licenseToken = parsed.MUBERT_LICENSE_TOKEN?.trim();
  if (companyId && licenseToken) {
    return getOrCreateCustomer({ companyId, licenseToken });
  }

  return null;
}

export async function testMubertCredentials(): Promise<{ ok: boolean; message: string }> {
  const credentials = await resolveMubertCredentials();
  if (!credentials) {
    return {
      ok: false,
      message:
        "Add either MUBERT_CUSTOMER_ID + MUBERT_ACCESS_TOKEN, or MUBERT_COMPANY_ID + MUBERT_LICENSE_TOKEN.",
    };
  }

  const res = await fetch(`${MUBERT_API_BASE}/playlists`, {
    headers: mubertPublicHeaders(credentials),
  });
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      message:
        "Mubert rejected the customer-id/access-token pair. If Mubert gave you company-id/license-token, re-save them in those fields.",
    };
  }
  if (!res.ok) return { ok: false, message: `HTTP ${res.status}: ${res.statusText}` };

  const json = await res.json();
  const count = Array.isArray(json.data) ? json.data.length : 0;
  return { ok: true, message: `Mubert is reachable - ${count} channel(s) available` };
}

export function buildMubertPrompt(parts: Array<string | null | undefined>): string {
  const text = parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= 200) return text;
  return text.slice(0, 197).replace(/\s+\S*$/, "").trimEnd() + "...";
}

export async function generateMubertTrack(params: {
  prompt: string;
  durationSeconds: number;
  intensity?: "low" | "medium" | "high";
  format?: "mp3" | "wav";
}): Promise<GeneratedMubertTrack> {
  const credentials = await getMubertCredentials();
  if (!credentials) {
    throw new Error("Add Mubert customer-id and access-token in Settings -> AI Providers.");
  }

  const duration = Math.max(15, Math.min(1500, Math.round(params.durationSeconds || 60)));
  const format = params.format ?? "mp3";
  const track = await createTrack(credentials, {
    prompt: params.prompt,
    duration,
    intensity: params.intensity ?? "medium",
    format,
  });

  const completed = await waitForTrack(credentials, track.id);
  const generation = completed.generations?.find((item) => item.status === "done" && item.url);
  if (!generation?.url) {
    throw new Error("Mubert finished without returning a downloadable track URL.");
  }

  const extension = generation.format === "wav" ? "wav" : "mp3";
  return {
    trackId: completed.id,
    url: generation.url,
    durationSeconds: completed.duration ?? duration,
    extension,
    mimeType: extension === "wav" ? "audio/wav" : "audio/mpeg",
  };
}

async function createTrack(
  credentials: MubertCredentials,
  body: {
    prompt: string;
    duration: number;
    intensity: "low" | "medium" | "high";
    format: "mp3" | "wav";
  }
): Promise<MubertTrack> {
  const res = await fetch(`${MUBERT_API_BASE}/tracks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...mubertPublicHeaders(credentials),
    },
    body: JSON.stringify({
      prompt: body.prompt,
      duration: body.duration,
      bitrate: 192,
      mode: "track",
      intensity: body.intensity,
      format: body.format,
    }),
  });

  if (!res.ok) {
    const message = await readResponseMessage(res);
    throw new Error(`Mubert track generation failed: ${message}`);
  }

  if (res.status === 204) {
    throw new Error(
      "Mubert accepted the request but did not return a track id. Enable JSON track responses or webhooks on your Mubert API plan."
    );
  }

  const json = await res.json().catch(() => null) as { data?: MubertTrack } | null;
  if (!json?.data?.id) {
    throw new Error("Mubert did not return a track id.");
  }
  return json.data;
}

async function waitForTrack(credentials: MubertCredentials, trackId: string): Promise<MubertTrack> {
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const track = await getTrack(credentials, trackId);
    const generation = track.generations?.[0];
    if (generation?.status === "done" && generation.url) return track;
    if (generation?.status === "failed") {
      throw new Error("Mubert reported that the track generation failed.");
    }
    await sleep(5000);
  }
  throw new Error("Mubert track generation timed out. Try again in a few minutes.");
}

async function getTrack(credentials: MubertCredentials, trackId: string): Promise<MubertTrack> {
  const res = await fetch(`${MUBERT_API_BASE}/tracks/${trackId}`, {
    headers: mubertPublicHeaders(credentials),
  });

  if (!res.ok) {
    const message = await readResponseMessage(res);
    throw new Error(`Could not check Mubert track status: ${message}`);
  }

  const json = await res.json() as { data?: MubertTrack };
  if (!json.data) throw new Error("Mubert returned an empty track status response.");
  return json.data;
}

async function getOrCreateCustomer(credentials: MubertServiceCredentials): Promise<MubertCredentials> {
  const customId = process.env.MUBERT_CUSTOM_ID?.trim() || DEFAULT_CUSTOM_ID;
  const existing = await fetch(`${MUBERT_SERVICE_BASE}/customers/custom-id/${encodeURIComponent(customId)}`, {
    headers: mubertServiceHeaders(credentials),
  });

  if (existing.ok) {
    return extractCustomerCredentials(await existing.json());
  }

  if (existing.status !== 404) {
    const message = await readResponseMessage(existing);
    throw new Error(`Could not verify Mubert service credentials: ${message}`);
  }

  const created = await fetch(`${MUBERT_SERVICE_BASE}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...mubertServiceHeaders(credentials),
    },
    body: JSON.stringify({ custom_id: customId }),
  });

  if (!created.ok) {
    const message = await readResponseMessage(created);
    throw new Error(`Could not create Mubert customer token: ${message}`);
  }

  return extractCustomerCredentials(await created.json());
}

function extractCustomerCredentials(json: unknown): MubertCredentials {
  const data = (json as { data?: Record<string, unknown> }).data;
  const access = data?.access as Record<string, unknown> | undefined;
  const customerId =
    valueAsString(access?.customer_id) ||
    valueAsString(access?.customerId) ||
    valueAsString(data?.id);
  const accessToken =
    valueAsString(access?.access_token) ||
    valueAsString(access?.accessToken) ||
    valueAsString(access?.token);

  if (!customerId || !accessToken) {
    throw new Error("Mubert did not return a usable customer-id/access-token pair.");
  }

  return { customerId, accessToken };
}

function mubertPublicHeaders(credentials: MubertCredentials): Record<string, string> {
  return {
    "customer-id": credentials.customerId,
    "access-token": credentials.accessToken,
  };
}

function mubertServiceHeaders(credentials: MubertServiceCredentials): Record<string, string> {
  return {
    "company-id": credentials.companyId,
    "license-token": credentials.licenseToken,
  };
}

async function readResponseMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return `HTTP ${res.status}: ${res.statusText}`;
  try {
    const json = JSON.parse(text) as { message?: string; error?: string };
    return json.message ?? json.error ?? text;
  } catch {
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function valueAsString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
