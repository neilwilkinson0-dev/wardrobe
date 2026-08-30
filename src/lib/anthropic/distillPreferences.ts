import Anthropic from "@anthropic-ai/sdk";

const DISTILL_MODEL = "claude-haiku-4-5";

export interface FeedbackForDistilling {
  rating: number | null;
  quick_reasons: string[] | null;
  freeform: string | null;
  context: unknown;
}

/**
 * Turns accumulated suggestion feedback into a short list of durable style
 * principles per spec §8 — "Claude turns accumulated feedback into a short
 * set of durable style principles that ride along with every future
 * suggestion." Returns null (never throws) if there's no key or nothing
 * useful to say, so callers can just skip updating preferences.
 */
export async function distillStylePrinciples(
  feedback: FeedbackForDistilling[],
): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || feedback.length === 0) return null;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: DISTILL_MODEL,
    max_tokens: 512,
    system: `You distill a user's feedback on daily outfit suggestions into a short set of durable style principles for a wardrobe app.

Respond with ONLY a single JSON object, no prose, no markdown fences:
{ "principles": string[] }

Rules:
- Each principle is a short, concrete, durable statement about their taste, e.g. "Prefers muted, tonal colour pairings over bold contrast", "Doesn't like suede or wool in wet weather", "Casual over smart-casual for WFH days".
- Only state a principle when the feedback pattern actually supports it — a single one-off "boring" doesn't justify a sweeping rule; look for repetition across entries.
- A contextual "no" (e.g. "wrong for weather" on a rainy day) is about that context, not a permanent dislike — don't generalise it into a blanket rule.
- 3-8 principles. If the feedback is too sparse or inconsistent to say anything durable, return an empty array rather than guessing.`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({ feedback }),
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  const jsonText = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/```\s*$/, "");

  try {
    const parsed = JSON.parse(jsonText) as { principles: string[] };
    return Array.isArray(parsed.principles) ? parsed.principles : null;
  } catch {
    return null;
  }
}
