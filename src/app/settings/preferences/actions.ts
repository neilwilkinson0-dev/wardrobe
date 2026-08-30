"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { distillStylePrinciples } from "@/lib/anthropic/distillPreferences";

export type UpdatePreferencesState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

function readList(formData: FormData, key: string): string[] {
  return (
    (formData.get(key) as string | null)
      ?.split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}

export async function updatePreferencesAction(
  _prevState: UpdatePreferencesState,
  formData: FormData,
): Promise<UpdatePreferencesState> {
  const supabase = await createClient();

  const stylePrinciples = readList(formData, "stylePrinciples");
  const occasionTags = readList(formData, "occasionTags");
  const namingPlayfulness = (formData.get("namingPlayfulness") as string | null)?.trim() || "moderate";

  const { error } = await supabase
    .from("preferences")
    .update({
      style_principles: stylePrinciples,
      occasion_tags: occasionTags,
      naming_playfulness: namingPlayfulness,
    });

  if (error) {
    return { status: "error", message: `Couldn't save: ${error.message}` };
  }

  revalidatePath("/settings/preferences");
  return { status: "saved" };
}

export type RedistillState = { status: "idle" } | { status: "done"; count: number } | { status: "error"; message: string };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState requires this signature
export async function redistillAction(_prevState: RedistillState): Promise<RedistillState> {
  const supabase = await createClient();

  const { data: feedback } = await supabase
    .from("feedback")
    .select("rating, quick_reasons, freeform, context")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!feedback || feedback.length === 0) {
    return { status: "error", message: "No feedback recorded yet — rate a few suggestions first." };
  }

  const principles = await distillStylePrinciples(feedback);
  if (!principles) {
    return { status: "error", message: "Couldn't distill principles (no ANTHROPIC_API_KEY set, or nothing durable found)." };
  }

  await supabase.from("preferences").update({ style_principles: principles });

  revalidatePath("/settings/preferences");
  return { status: "done", count: feedback.length };
}
