"use server";

import { createClient } from "@/lib/supabase/server";
import { analyzeStyle, type StyleGap, type StyleStretch } from "@/lib/anthropic/analyzeStyle";
import { getShoppingGuidance, type ShoppingSuggestion } from "@/lib/anthropic/shoppingGuidance";

export type StyleState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; description: string; gaps: StyleGap[]; stretches: StyleStretch[] };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState requires this signature
export async function analyzeStyleAction(_prevState: StyleState): Promise<StyleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const { data: items } = await supabase
    .from("items")
    .select("subcategory, colours, pattern, formality, categories(name)")
    .eq("retired", false);

  if (!items || items.length === 0) {
    return { status: "error", message: "Add a few items first — nothing to analyse yet." };
  }

  const { data: preferences } = await supabase
    .from("preferences")
    .select("style_principles, colouring_profile")
    .maybeSingle();

  let result;
  try {
    result = await analyzeStyle({
      items: items.map((item) => ({
        category: item.categories?.name ?? null,
        subcategory: item.subcategory,
        colours: item.colours as { dominant?: string[]; secondary?: string[] } | null,
        pattern: item.pattern,
        formality: item.formality,
      })),
      stylePrinciples: Array.isArray(preferences?.style_principles)
        ? (preferences.style_principles as string[])
        : [],
      colouringProfile: preferences?.colouring_profile ?? null,
    });
  } catch (err) {
    return {
      status: "error",
      message: `Couldn't analyse your style: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  if (!result) {
    return { status: "error", message: "Style analysis is off (no ANTHROPIC_API_KEY set)." };
  }

  return { status: "ready", description: result.description, gaps: result.gaps, stretches: result.stretches };
}

export type ShoppingState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; suggestions: ShoppingSuggestion[] };

export async function getShoppingGuidanceAction(
  _prevState: ShoppingState,
  formData: FormData,
): Promise<ShoppingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const description = formData.get("description") as string | null;
  const gapsRaw = formData.get("gaps") as string | null;
  const stretchesRaw = formData.get("stretches") as string | null;

  let gaps: StyleGap[] = [];
  let stretches: StyleStretch[] = [];
  try {
    gaps = gapsRaw ? JSON.parse(gapsRaw) : [];
    stretches = stretchesRaw ? JSON.parse(stretchesRaw) : [];
  } catch {
    return { status: "error", message: "Lost track of the style analysis — try analysing again." };
  }

  if (!description) {
    return { status: "error", message: "Missing style analysis — try analysing again." };
  }

  const { data: preferences } = await supabase
    .from("preferences")
    .select("style_principles, colouring_profile")
    .maybeSingle();

  let suggestions: ShoppingSuggestion[] | null;
  try {
    suggestions = await getShoppingGuidance({
      description,
      gaps,
      stretches,
      stylePrinciples: Array.isArray(preferences?.style_principles)
        ? (preferences.style_principles as string[])
        : [],
      colouringProfile: preferences?.colouring_profile ?? null,
    });
  } catch (err) {
    return {
      status: "error",
      message: `Couldn't get shopping guidance: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  if (!suggestions) {
    return { status: "error", message: "Shopping guidance is off (no ANTHROPIC_API_KEY set)." };
  }

  return { status: "ready", suggestions };
}
