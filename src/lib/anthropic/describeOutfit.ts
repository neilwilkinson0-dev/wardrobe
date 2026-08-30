import Anthropic from "@anthropic-ai/sdk";

const DESCRIBE_MODEL = "claude-haiku-4-5";

export interface OutfitSlotDescription {
  description: string;
  colours: string[];
  pattern: string | null;
}

export interface OutfitDescription {
  top: OutfitSlotDescription | null;
  bottom: OutfitSlotDescription | null;
  footwear: OutfitSlotDescription | null;
  outer_layer: OutfitSlotDescription | null;
}

function mediaTypeFromBuffer(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

/**
 * Describes what's visible in a photo of a whole outfit, one entry per role
 * slot — this is deliberately text-only per slot (no item matching here).
 * Matching those descriptions to specific wardrobe items happens in
 * lib/wear/matchCandidates.ts, over structured data rather than more vision
 * calls, since the user's full item list can't reasonably be sent as images.
 */
export async function describeOutfitPhoto(photo: Buffer): Promise<OutfitDescription | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: DESCRIBE_MODEL,
    max_tokens: 768,
    system: `You describe an outfit from a photo of someone wearing it (or the clothes laid out together) for a wardrobe app.

Respond with ONLY a single JSON object, no prose, no markdown fences. Shape:
{
  "top": { "description": string, "colours": string[], "pattern": string | null } | null,
  "bottom": { "description": string, "colours": string[], "pattern": string | null } | null,
  "footwear": { "description": string, "colours": string[], "pattern": string | null } | null,
  "outer_layer": { "description": string, "colours": string[], "pattern": string | null } | null
}

Rules:
- One entry per slot that is actually visible in the photo; null for any slot not visible (e.g. no outer layer worn).
- "description" is a short garment description, e.g. "navy crew-neck t-shirt", "grey chinos", "white leather trainers".
- "colours" lists the visible colours, most dominant first.
- Only describe what is visibly worn — do not guess brand, size, or anything not visible.`,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What is being worn in this photo?" },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaTypeFromBuffer(photo),
              data: photo.toString("base64"),
            },
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`Unexpected response shape (stop_reason: ${message.stop_reason})`);
  }

  const jsonText = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/```\s*$/, "");

  try {
    return JSON.parse(jsonText) as OutfitDescription;
  } catch {
    throw new Error(`Couldn't parse the model's response: ${jsonText.slice(0, 200)}`);
  }
}
