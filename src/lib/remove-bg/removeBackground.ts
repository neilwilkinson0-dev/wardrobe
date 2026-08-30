const REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg";

/**
 * Produces a transparent PNG cut-out of a garment photo via remove.bg.
 * Returns null (rather than throwing) when no API key is configured, so the
 * add-item flow can proceed without a cut-out until the key is added.
 */
export async function removeBackground(image: Buffer): Promise<Buffer | null> {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return null;

  const formData = new FormData();
  formData.append("size", "auto");
  formData.append("image_file", new Blob([new Uint8Array(image)]), "garment.jpg");

  const response = await fetch(REMOVE_BG_ENDPOINT, {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`remove.bg request failed (${response.status}): ${detail}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
