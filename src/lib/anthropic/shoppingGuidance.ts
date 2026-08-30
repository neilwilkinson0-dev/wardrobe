import Anthropic from "@anthropic-ai/sdk";
import type { StyleGap, StyleStretch } from "./analyzeStyle";

const SHOPPING_MODEL = "claude-haiku-4-5";

export interface ShoppingSuggestion {
  item_type: string;
  shops: string[];
  search_term: string;
  price_range: string;
  unlocks: string;
}

/**
 * Layer 4 of the style engine (spec §10) — the one layer that needs live
 * grounding, since UK shop ranges/prices go stale fast. Uses the web_search
 * server tool so Claude can check current data itself; no client-side tool
 * loop needed since it's a server-side tool. No live product links or
 * try-on here — both are phase 2 (spec §12) — just item type, shops, and a
 * search term.
 */
export async function getShoppingGuidance(params: {
  description: string;
  gaps: StyleGap[];
  stretches: StyleStretch[];
  stylePrinciples: string[];
  colouringProfile: unknown;
}): Promise<ShoppingSuggestion[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: SHOPPING_MODEL,
    max_tokens: 2048,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
    system: `You give UK shopping guidance for a wardrobe app, grounded in current web search results — never from memory alone, since shop ranges and prices go stale.

Use the web_search tool to check current UK shops and rough price ranges for each suggestion before answering.

After searching, respond with a final message containing ONLY a single JSON object, no prose, no markdown fences:
{ "suggestions": [ { "item_type": string, "shops": string[], "search_term": string, "price_range": string, "unlocks": string } ] }

Rules:
- Base suggestions on the gaps and stretches given — this is about filling real holes and extending owned combinations, not general trend-chasing.
- "shops" are 2-3 real current UK retailers matching the person's style and typical budget (found via search, not guessed).
- "search_term" is a short, literal phrase they could type into a shop's search bar.
- "price_range" is a rough current UK price band from your search (e.g. "~£40-70").
- "unlocks" names specifically what owned combinations this piece would complete or extend — never suggest a piece with no tie to items already owned.
- Do not include live product links or specific in-stock items — type of piece + shops + search term only.
- 2-4 suggestions.`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          description: params.description,
          gaps: params.gaps,
          stretches: params.stretches,
          style_principles: params.stylePrinciples,
          colouring_profile: params.colouringProfile,
        }),
      },
    ],
  });

  // Server tools can interleave text/tool-use blocks before the final
  // answer — the JSON we want is the last text block, not necessarily the
  // only one.
  const textBlock = [...message.content].reverse().find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`Unexpected response shape (stop_reason: ${message.stop_reason})`);
  }

  const jsonText = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/```\s*$/, "");

  try {
    const parsed = JSON.parse(jsonText) as { suggestions: ShoppingSuggestion[] };
    return Array.isArray(parsed.suggestions) ? parsed.suggestions : null;
  } catch {
    throw new Error(`Couldn't parse the model's response: ${jsonText.slice(0, 200)}`);
  }
}
