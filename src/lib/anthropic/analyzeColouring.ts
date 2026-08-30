import Anthropic from "@anthropic-ai/sdk";

const ANALYZE_MODEL = "claude-haiku-4-5";

export interface ColouringDraft {
  undertone: "cool" | "warm" | "neutral" | null;
  flattering_colours: string[];
  unflattering_colours: string[];
  notes: string;
}

function mediaTypeFromBuffer(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

/**
 * A *tentative* read of undertone/flattering colours from photos — per spec
 * §9, colouring is "exactly what a photo reads unreliably" (lighting and
 * white-balance skew undertone), so this is explicitly a starting guess for
 * the user to confirm or overrule, never an auto-verdict written straight to
 * their profile.
 */
export async function analyzeColouringPhotos(photos: Buffer[]): Promise<ColouringDraft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || photos.length === 0) return null;

  const client = new Anthropic({ apiKey });

  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: "Here are one or more photos of a person in what looks like natural light. Give a tentative colouring read.",
    },
    ...photos.map(
      (photo): Anthropic.Messages.ContentBlockParam => ({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaTypeFromBuffer(photo),
          data: photo.toString("base64"),
        },
      }),
    ),
  ];

  const message = await client.messages.create({
    model: ANALYZE_MODEL,
    max_tokens: 512,
    system: `You give a tentative "seasonal colour analysis"-style read (skin undertone, hair, eyes) from photos for a wardrobe app.

This is explicitly a starting guess, not a verdict — lighting and white balance make undertone genuinely unreliable to read from a photo, so hedge accordingly.

Respond with ONLY a single JSON object, no prose, no markdown fences:
{
  "undertone": "cool" | "warm" | "neutral" | null,
  "flattering_colours": string[],
  "unflattering_colours": string[],
  "notes": string
}

Rules:
- "flattering_colours" and "unflattering_colours" are colour families (e.g. "navy", "olive", "camel", "cool pink"), not specific garments.
- "notes" is one or two sentences, written with humility (e.g. "Tentative — the lighting suggests a cool undertone, but this is just a starting guess to confirm or override.").
- If the photos are too unclear to say anything useful, return null for undertone and empty arrays rather than guessing.`,
    messages: [{ role: "user", content }],
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
    return JSON.parse(jsonText) as ColouringDraft;
  } catch {
    throw new Error(`Couldn't parse the model's response: ${jsonText.slice(0, 200)}`);
  }
}
