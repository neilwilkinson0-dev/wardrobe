"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classifyItem, type ClassificationDraft } from "@/lib/anthropic/classifyItem";
import { removeBackground } from "@/lib/remove-bg/removeBackground";

export type ClassifyState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "drafted";
      originalPhotoPath: string;
      cutoutPath: string | null;
      draft: ClassificationDraft | null;
      notice: string | null;
    };

export type SaveState = { status: "idle" } | { status: "error"; message: string };

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function classifyItemAction(
  _prevState: ClassifyState,
  formData: FormData,
): Promise<ClassifyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const garmentFile = formData.get("garmentPhoto");
  if (!(garmentFile instanceof File) || garmentFile.size === 0) {
    return { status: "error", message: "A garment photo is required." };
  }

  const labelFile = formData.get("labelPhoto");
  const hasLabel = labelFile instanceof File && labelFile.size > 0;

  const garmentBuffer = Buffer.from(await garmentFile.arrayBuffer());
  const labelBuffer = hasLabel ? Buffer.from(await (labelFile as File).arrayBuffer()) : undefined;

  const originalPhotoPath = `${user.id}/${randomUUID()}.${extensionFor(garmentFile)}`;
  const { error: uploadError } = await supabase.storage
    .from("originals")
    .upload(originalPhotoPath, garmentBuffer, { contentType: garmentFile.type || "image/jpeg" });

  if (uploadError) {
    return { status: "error", message: `Couldn't upload photo: ${uploadError.message}` };
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("name, role")
    .order("name");

  const notices: string[] = [];

  let draft: ClassificationDraft | null = null;
  try {
    draft = await classifyItem({
      garmentPhoto: garmentBuffer,
      labelPhoto: labelBuffer,
      existingCategories: categories ?? [],
    });
    if (!draft) notices.push("Auto-classification is off (no ANTHROPIC_API_KEY set) — fill in the details manually.");
  } catch (err) {
    notices.push(`Auto-classification failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  let cutoutPath: string | null = null;
  try {
    const cutoutBuffer = await removeBackground(garmentBuffer);
    if (cutoutBuffer) {
      cutoutPath = `${user.id}/${randomUUID()}.png`;
      const { error: cutoutUploadError } = await supabase.storage
        .from("cutouts")
        .upload(cutoutPath, cutoutBuffer, { contentType: "image/png" });
      if (cutoutUploadError) {
        cutoutPath = null;
        notices.push(`Couldn't save the cut-out: ${cutoutUploadError.message}`);
      }
    } else {
      notices.push("Background removal is off (no REMOVE_BG_API_KEY set) — no cut-out for now.");
    }
  } catch (err) {
    notices.push(`Background removal failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  return {
    status: "drafted",
    originalPhotoPath,
    cutoutPath,
    draft,
    notice: notices.length > 0 ? notices.join(" ") : null,
  };
}

export async function saveItemAction(
  _prevState: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const originalPhotoPath = formData.get("originalPhotoPath");
  if (typeof originalPhotoPath !== "string" || !originalPhotoPath) {
    return { status: "error", message: "Missing photo — start again." };
  }
  const cutoutPathRaw = formData.get("cutoutPath");
  const cutoutPath = typeof cutoutPathRaw === "string" && cutoutPathRaw ? cutoutPathRaw : null;

  const categoryMode = formData.get("categoryMode");

  let categoryId: string;
  if (categoryMode === "new") {
    const name = (formData.get("newCategoryName") as string | null)?.trim();
    const role = formData.get("newCategoryRole");
    if (!name || typeof role !== "string" || !role) {
      return { status: "error", message: "New category needs a name and role." };
    }

    const { data: newCategory, error: categoryError } = await supabase
      .from("categories")
      .insert({ name, role })
      .select("id")
      .single();

    if (categoryError || !newCategory) {
      return {
        status: "error",
        message: `Couldn't create category: ${categoryError?.message ?? "unknown error"}`,
      };
    }
    categoryId = newCategory.id;
  } else {
    const existing = formData.get("existingCategoryId");
    if (typeof existing !== "string" || !existing) {
      return { status: "error", message: "Pick a category." };
    }
    categoryId = existing;
  }

  const readList = (key: string) =>
    (formData.get(key) as string | null)
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  const readConfidence = (): Record<string, string> => {
    const raw = formData.get("confidence");
    if (typeof raw !== "string" || !raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const readNumber = (key: string): number | null => {
    const raw = formData.get(key);
    if (typeof raw !== "string" || raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const readText = (key: string): string | null => {
    const raw = formData.get(key);
    return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
  };

  const { error: insertError } = await supabase.from("items").insert({
    category_id: categoryId,
    subcategory: readText("subcategory"),
    colours: { dominant: readList("coloursDominant"), secondary: readList("coloursSecondary") },
    pattern: readText("pattern"),
    formality: readText("formality"),
    silhouette: readText("silhouette"),
    season_suitability: readText("seasonSuitability"),
    material: readText("material"),
    care: readText("care"),
    brand: readText("brand"),
    size: readText("size"),
    price: readNumber("price"),
    acquired_note: readText("acquiredNote"),
    notes: readText("notes"),
    original_photo_path: originalPhotoPath,
    cutout_path: cutoutPath,
    confidence: readConfidence(),
  });

  if (insertError) {
    return { status: "error", message: `Couldn't save item: ${insertError.message}` };
  }

  redirect("/");
}
