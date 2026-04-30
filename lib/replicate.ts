type ReplicateVersion = { id: string };

const SDXL_MODEL_OWNER = "stability-ai";
const SDXL_MODEL_NAME = "sdxl";
const FALLBACK_SDXL_VERSION_ID = "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc";

let cachedSdxlVersionId: string | null = null;

export async function getSdxlVersionId(token: string): Promise<string> {
  if (process.env.REPLICATE_SDXL_VERSION_ID?.trim()) {
    return process.env.REPLICATE_SDXL_VERSION_ID.trim();
  }
  if (cachedSdxlVersionId) return cachedSdxlVersionId;

  const res = await fetch(`https://api.replicate.com/v1/models/${SDXL_MODEL_OWNER}/${SDXL_MODEL_NAME}/versions`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    console.warn(`[replicate] Could not fetch SDXL versions: ${res.status}${message ? ` - ${message}` : ""}`);
    return FALLBACK_SDXL_VERSION_ID;
  }

  const json = (await res.json()) as { results?: ReplicateVersion[] };
  const versionId = json.results?.[0]?.id ?? FALLBACK_SDXL_VERSION_ID;
  cachedSdxlVersionId = versionId;
  return versionId;
}

export async function createSdxlPrediction(token: string, prompt: string) {
  const version = await getSdxlVersionId(token);
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      version,
      input: {
        prompt,
        negative_prompt:
          "real person, celebrity, public figure, politician, athlete, logo, text, watermark, brand, copyright, trademarked",
        width: 768,
        height: 1024,
        num_outputs: 3,
      },
    }),
  });
  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(`Replicate failed: ${res.status}${message ? ` - ${message}` : ""}`);
  }
  return res.json() as Promise<{ urls: { get: string }; output?: string[]; status: string }>;
}

export async function waitForReplicatePrediction(token: string, getUrl: string): Promise<string[]> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const res = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Replicate poll failed: ${res.status}`);
    const prediction = (await res.json()) as { status: string; output?: string[]; error?: string };
    if (prediction.status === "succeeded" && prediction.output) return prediction.output;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(prediction.error ?? "Replicate prediction failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Replicate prediction timed out");
}
