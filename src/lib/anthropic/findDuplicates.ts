import Anthropic from "@anthropic-ai/sdk";

const DUPLICATE_MODEL = "claude-haiku-4-5";

export interface LabeledImage {
  label: string;
  buffer: Buffer;
}

function mediaTypeFromBuffer(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

/**
 * Finds near-duplicate garments by actually comparing the photos, rather
 * than comparing classified text fields (category/colour/pattern) — that
 * proxy was too coarse to tell "this exact navy crew" from "a different
 * navy crew that happens to share a colour and category".
 *
 * Returns groups of 2+ labels that look like the same or a near-identical
 * garment; items with no match are simply omitted from the result.
 */
export async function findVisualDuplicateGroups(images: LabeledImage[]): Promise<string[][] | null> {
  if (images.length < 2) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const content: Anthropic.Messages.ContentBlockParam[] = images.flatMap((img) => [
    { type: "text", text: `Label: ${img.label}` },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaTypeFromBuffer(img.buffer),
        data: img.buffer.toString("base64"),
      },
    },
  ]);

  const message = await client.messages.create({
    model: DUPLICATE_MODEL,
    max_tokens: 1024,
    system: `You compare clothing photos for a wardrobe app to find near-duplicate garments — the same or an extremely similar physical item, the kind of thing where someone would reasonably think "wait, don't I already own this?"

Respond with ONLY a single JSON object, no prose, no markdown fences:
{ "groups": [ ["label1", "label2"], ... ] }

Rules:
- Judge the actual garment shown — cut, exact colour, pattern, fabric, style. Being in the same broad category or colour family is NOT enough on its own.
- A worn photo vs. a flat-lay of the same garment can still match — judge the garment, not the photo style or background.
- Only include groups of 2 or more labels. Leave out any label with no plausible duplicate entirely — don't force weak matches.
- If genuinely unsure, don't group them — a missed duplicate is better than a false one.`,
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
    const parsed = JSON.parse(jsonText) as { groups: string[][] };
    return Array.isArray(parsed.groups) ? parsed.groups : [];
  } catch {
    throw new Error(`Couldn't parse the model's response: ${jsonText.slice(0, 200)}`);
  }
}
