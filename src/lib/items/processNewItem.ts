import { createClient } from "@/lib/supabase/server";
import { classifyItem } from "@/lib/anthropic/classifyItem";
import { removeBackground } from "@/lib/remove-bg/removeBackground";
import { findVisualDuplicateGroups, type LabeledImage } from "@/lib/anthropic/findDuplicates";
import { randomUUID } from "crypto";

const MAX_DUPLICATE_CANDIDATES = 8;

/**
 * Runs after quickAddItemAction's response has already been sent (via
 * next/server's `after`), so the browser never waits on classification or
 * background removal — the item row starts as classification_status:
 * 'pending' and this fills it in once the AI calls finish.
 */
export async function processNewItem(params: {
  userId: string;
  itemId: string;
  originalPhotoPath: string;
  labelPhotoPath: string | null;
}): Promise<void> {
  const { userId, itemId, originalPhotoPath, labelPhotoPath } = params;
  const supabase = await createClient();

  const notices: string[] = [];

  const download = async (
    path: string,
    bucket: "originals" | "cutouts" = "originals",
  ): Promise<Buffer | null> => {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  };

  const garmentBuffer = await download(originalPhotoPath);
  if (!garmentBuffer) {
    await supabase
      .from("items")
      .update({
        classification_status: "done",
        processing_notices: ["Couldn't read the uploaded photo — edit this item manually."],
      })
      .eq("id", itemId);
    return;
  }

  const labelBuffer = labelPhotoPath ? await download(labelPhotoPath) : null;

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, role")
    .order("name");

  const [classifyResult, cutoutResult] = await Promise.allSettled([
    classifyItem({
      garmentPhoto: garmentBuffer,
      labelPhoto: labelBuffer ?? undefined,
      existingCategories: categories ?? [],
    }),
    removeBackground(garmentBuffer),
  ]);

  if (labelPhotoPath) {
    await supabase.storage.from("originals").remove([labelPhotoPath]);
  }

  const draft = classifyResult.status === "fulfilled" ? classifyResult.value : null;
  if (classifyResult.status === "rejected") {
    notices.push(
      `Auto-classification failed: ${classifyResult.reason instanceof Error ? classifyResult.reason.message : "unknown error"}`,
    );
  } else if (!draft) {
    notices.push("Auto-classification is off (no ANTHROPIC_API_KEY set) — fill in the details manually.");
  }

  let cutoutPath: string | null = null;
  if (cutoutResult.status === "fulfilled" && cutoutResult.value) {
    cutoutPath = `${userId}/${randomUUID()}.png`;
    const { error: cutoutUploadError } = await supabase.storage
      .from("cutouts")
      .upload(cutoutPath, cutoutResult.value, { contentType: "image/png" });
    if (cutoutUploadError) {
      cutoutPath = null;
      notices.push(`Couldn't save the cut-out: ${cutoutUploadError.message}`);
    }
  } else if (cutoutResult.status === "rejected") {
    notices.push(
      `Background removal failed: ${cutoutResult.reason instanceof Error ? cutoutResult.reason.message : "unknown error"}`,
    );
  } else if (cutoutResult.status === "fulfilled") {
    notices.push("Background removal is off (no REMOVE_BG_API_KEY set) — no cut-out for now.");
  }

  let categoryId: string | null = null;
  if (draft) {
    const matched = categories?.find(
      (c) => c.name.toLowerCase() === draft.category_guess?.toLowerCase(),
    );
    if (matched) {
      categoryId = matched.id;
    } else if (draft.category_is_new && draft.new_category_role) {
      const { data: newCategory, error: categoryError } = await supabase
        .from("categories")
        .insert({ name: draft.category_guess, role: draft.new_category_role })
        .select("id")
        .single();
      if (newCategory) {
        categoryId = newCategory.id;
      } else {
        notices.push(
          `Couldn't create category "${draft.category_guess}": ${categoryError?.message ?? "unknown error"} — set one manually.`,
        );
      }
    } else {
      notices.push("Couldn't determine a category — set one manually.");
    }
  }

  let possibleDuplicateIds: string[] = [];
  if (categoryId) {
    const { data: candidates } = await supabase
      .from("items")
      .select("id, cutout_path, original_photo_path")
      .eq("category_id", categoryId)
      .neq("id", itemId)
      .order("added_date", { ascending: false })
      .limit(MAX_DUPLICATE_CANDIDATES);

    if (candidates && candidates.length > 0) {
      const images: LabeledImage[] = [{ label: "NEW", buffer: garmentBuffer }];
      for (const candidate of candidates) {
        const bucket = candidate.cutout_path ? "cutouts" : "originals";
        const path = candidate.cutout_path ?? candidate.original_photo_path;
        const buffer = await download(path, bucket);
        if (buffer) images.push({ label: candidate.id, buffer });
      }

      try {
        const groups = await findVisualDuplicateGroups(images);
        const newGroup = groups?.find((group) => group.includes("NEW"));
        if (newGroup) {
          possibleDuplicateIds = newGroup.filter((label) => label !== "NEW");
        }
      } catch (err) {
        notices.push(
          `Duplicate check failed: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }

    if (possibleDuplicateIds.length > 0) {
      notices.push(
        `Looks like the same or a near-identical garment as ${possibleDuplicateIds.length} item${possibleDuplicateIds.length === 1 ? "" : "s"} you already own.`,
      );
    }
  }

  await supabase
    .from("items")
    .update({
      category_id: categoryId,
      subcategory: draft?.subcategory ?? null,
      colours: draft?.colours ?? null,
      pattern: draft?.pattern ?? null,
      formality: draft?.formality ?? null,
      silhouette: draft?.silhouette ?? null,
      season_suitability: draft?.season_suitability ?? null,
      material: draft?.material ?? null,
      care: draft?.care ?? null,
      brand: draft?.brand ?? null,
      size: draft?.size ?? null,
      confidence: draft?.confidence ?? null,
      cutout_path: cutoutPath,
      classification_status: "done",
      processing_notices: notices.length > 0 ? notices : null,
      possible_duplicate_ids: possibleDuplicateIds.length > 0 ? possibleDuplicateIds : null,
    })
    .eq("id", itemId);
}
