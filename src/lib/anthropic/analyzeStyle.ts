import Anthropic from "@anthropic-ai/sdk";

const ANALYZE_MODEL = "claude-haiku-4-5";

export interface WardrobeItemSummary {
  category: string | null;
  subcategory: string | null;
  colours: { dominant?: string[]; secondary?: string[] } | null;
  pattern: string | null;
  formality: string | null;
}

export interface StyleGap {
  gap: string;
  reasoning: string;
}

export interface StyleStretch {
  direction: string;
  unlocks: string;
}

export interface StyleAnalysis {
  description: string;
  gaps: StyleGap[];
  stretches: StyleStretch[];
}

/**
 * Describe / gap / stretch — layers 1-3 of the style engine (spec §10).
 * Pure reasoning over the wardrobe already owned, no web search — that's
 * reserved for shopping guidance, which grounds current shop/price data.
 */
export async function analyzeStyle(params: {
  items: WardrobeItemSummary[];
  stylePrinciples: string[];
  colouringProfile: unknown;
}): Promise<StyleAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: ANALYZE_MODEL,
    max_tokens: 1536,
    system: `You are a style analyst for a wardrobe app, reasoning only over the clothes a user already owns.

Respond with ONLY a single JSON object, no prose, no markdown fences:
{
  "description": string,   // 2-4 sentences articulating their actual style as it shows up in the wardrobe (e.g. "casual-smart, earthy, muted, lots of navy and stone, minimal pattern")
  "gaps": [ { "gap": string, "reasoning": string } ],       // specific holes vs. a versatile wardrobe in their style — not generic advice
  "stretches": [ { "direction": string, "unlocks": string } ] // adjacent style directions, each naming exactly what it would unlock with items ALREADY owned
}

Rules:
- Base everything on the actual items given — don't invent items or assume a "typical" wardrobe.
- "gaps" should be specific and justified (e.g. "loads of tops, only one pair of shoes that works smart-casual"), not vague ("could use more variety").
- Every "stretches" entry must say what it unlocks with clothes already owned (e.g. "an olive overshirt would work over these four shirts and both chinos") — an adjacent direction with no tie to owned items doesn't belong here.
- 2-5 gaps, 2-4 stretches. If the wardrobe is too small to say anything specific, say so plainly in "description" and return empty arrays rather than generic filler.`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          items: params.items,
          style_principles: params.stylePrinciples,
          colouring_profile: params.colouringProfile,
        }),
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
    return JSON.parse(jsonText) as StyleAnalysis;
  } catch {
    throw new Error(`Couldn't parse the model's response: ${jsonText.slice(0, 200)}`);
  }
}
