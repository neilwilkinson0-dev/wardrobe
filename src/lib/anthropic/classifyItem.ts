import Anthropic from "@anthropic-ai/sdk";

export type FieldConfidence = "solid" | "tentative";

export interface ClassificationDraft {
  category_guess: string;
  category_is_new: boolean;
  new_category_role: "top" | "bottom" | "footwear" | "outer_layer" | "accessory" | null;
  subcategory: string | null;
  colours: { dominant: string[]; secondary: string[] };
  pattern: string | null;
  formality: string | null;
  silhouette: string | null;
  season_suitability: string | null;
  material: string | null;
  care: string | null;
  brand: string | null;
  size: string | null;
  confidence: Record<string, FieldConfidence>;
}

interface ExistingCategory {
  name: string;
  role: string;
}

const CLASSIFICATION_MODEL = "claude-haiku-4-5-20251001";

function mediaTypeFromBuffer(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

export async function classifyItem(params: {
  garmentPhoto: Buffer;
  labelPhoto?: Buffer;
  existingCategories: ExistingCategory[];
}): Promise<ClassificationDraft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const categoryList = params.existingCategories
    .map((c) => `- ${c.name} (role: ${c.role})`)
    .join("\n");

  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `Here is a photo of a garment. The user's existing categories are:\n${categoryList || "(none yet)"}\n\nClassify the garment.`,
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaTypeFromBuffer(params.garmentPhoto),
        data: params.garmentPhoto.toString("base64"),
      },
    },
  ];

  if (params.labelPhoto) {
    content.push(
      { type: "text", text: "Here is a photo of the garment's care label, if legible:" },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaTypeFromBuffer(params.labelPhoto),
          data: params.labelPhoto.toString("base64"),
        },
      },
    );
  }

  const message = await client.messages.create({
    model: CLASSIFICATION_MODEL,
    max_tokens: 1024,
    system: `You classify a single clothing item from photos for a wardrobe app.

Respond with ONLY a single JSON object, no prose, no markdown fences. Shape:
{
  "category_guess": string,        // best-matching name from the user's existing categories; if none fit, propose a short new one
  "category_is_new": boolean,      // true only if category_guess is not in the user's existing list
  "new_category_role": "top" | "bottom" | "footwear" | "outer_layer" | "accessory" | null, // required if category_is_new is true, else null
  "subcategory": string | null,    // e.g. "crew-neck jumper", "chinos"
  "colours": { "dominant": string[], "secondary": string[] },
  "pattern": string | null,        // e.g. "plain", "stripe", "check"
  "formality": string | null,      // e.g. "casual", "smart-casual", "formal"
  "silhouette": string | null,     // fit, e.g. "slim", "regular", "oversized"
  "season_suitability": string | null, // e.g. "all-season", "summer", "winter"
  "material": string | null,       // from the label photo if given, else a best guess
  "care": string | null,           // only if clearly legible on a label photo; otherwise null
  "brand": string | null,          // only from a label photo
  "size": string | null,           // only from a label photo
  "confidence": {
    // one entry per non-null field above (except category_guess/category_is_new/new_category_role),
    // "solid" if read directly off a label photo, "tentative" if guessed from the garment photo alone
  }
}

Never invent a brand, size, or care instruction that isn't visibly legible on a label photo — leave those null rather than guessing.`,
    messages: [{ role: "user", content }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    return JSON.parse(textBlock.text) as ClassificationDraft;
  } catch {
    return null;
  }
}
