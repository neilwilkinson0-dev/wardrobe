"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classifyItem, type ClassificationDraft } from "@/lib/anthropic/classifyItem";
import { removeBackground } from "@/lib/remove-bg/removeBackground";
import { scoreDuplicate, DUPLICATE_SCORE_THRESHOLD, MAX_DUPLICATE_SCORE } from "@/lib/duplicates/score";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function downloadFromStorage(
  supabase: SupabaseServerClient,
  bucket: "originals" | "cutouts",
  path: string,
): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`Couldn't read ${path} from ${bucket}: ${error?.message ?? "not found"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

export interface PossibleDuplicate {
  id: string;
  subcategory: string | null;
  thumbnailUrl: string | null;
  score: number;
}

export type ClassifyState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "drafted";
      originalPhotoPath: string;
      cutoutPath: string | null;
      draft: ClassificationDraft | null;
      notice: string | null;
      possibleDuplicates: PossibleDuplicate[];
    };

export type SaveState = { status: "idle" } | { status: "error"; message: string };

export async function classifyItemAction(
  _prevState: ClassifyState,
  formData: FormData,
): Promise<ClassifyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  // The browser uploads photos straight to Storage before calling this
  // action — Vercel caps a serverless function's own request body at 4.5MB
  // regardless of Next.js's bodySizeLimit config, which two full-res phone
  // photos routinely exceed. This action only ever receives small strings.
  const originalPhotoPath = formData.get("originalPhotoPath");
  if (typeof originalPhotoPath !== "string" || !originalPhotoPath) {
    return { status: "error", message: "Missing uploaded photo — try again." };
  }
  const labelPhotoPathRaw = formData.get("labelPhotoPath");
  const labelPhotoPath =
    typeof labelPhotoPathRaw === "string" && labelPhotoPathRaw ? labelPhotoPathRaw : null;

  let garmentBuffer: Buffer;
  try {
    garmentBuffer = await downloadFromStorage(supabase, "originals", originalPhotoPath);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Couldn't read the uploaded photo." };
  }

  let labelBuffer: Buffer | undefined;
  if (labelPhotoPath) {
    try {
      labelBuffer = await downloadFromStorage(supabase, "originals", labelPhotoPath);
    } catch {
      // Non-fatal — proceed with garment-only classification.
    }
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, role")
    .order("name");

  const notices: string[] = [];

  // Classification and background removal are independent calls to two
  // different services — run them concurrently rather than back-to-back,
  // since sequential awaits here were the main reason add-item felt slow.
  const [classifyResult, cutoutResult] = await Promise.allSettled([
    classifyItem({
      garmentPhoto: garmentBuffer,
      labelPhoto: labelBuffer,
      existingCategories: categories ?? [],
    }),
    removeBackground(garmentBuffer),
  ]);

  // The label photo only exists to inform classification — it's never
  // stored as part of the item, so clean it up once it's served its purpose.
  if (labelPhotoPath) {
    await supabase.storage.from("originals").remove([labelPhotoPath]);
  }

  let draft: ClassificationDraft | null = null;
  if (classifyResult.status === "fulfilled") {
    draft = classifyResult.value;
    if (!draft) notices.push("Auto-classification is off (no ANTHROPIC_API_KEY set) — fill in the details manually.");
  } else {
    notices.push(
      `Auto-classification failed: ${classifyResult.reason instanceof Error ? classifyResult.reason.message : "unknown error"}`,
    );
  }

  let cutoutPath: string | null = null;
  if (cutoutResult.status === "fulfilled") {
    const cutoutBuffer = cutoutResult.value;
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
  } else {
    notices.push(
      `Background removal failed: ${cutoutResult.reason instanceof Error ? cutoutResult.reason.message : "unknown error"}`,
    );
  }

  let possibleDuplicates: PossibleDuplicate[] = [];
  if (draft) {
    const matchedCategory = categories?.find(
      (c) => c.name.toLowerCase() === draft!.category_guess?.toLowerCase(),
    );

    if (matchedCategory) {
      const { data: candidates } = await supabase
        .from("items")
        .select("id, subcategory, colours, pattern, formality, cutout_path, original_photo_path")
        .eq("category_id", matchedCategory.id);

      const scored = (candidates ?? [])
        .map((candidate) => ({
          candidate,
          score: scoreDuplicate(
            { category_id: matchedCategory.id, colours: draft!.colours, pattern: draft!.pattern, formality: draft!.formality },
            {
              category_id: matchedCategory.id,
              colours: candidate.colours as { dominant?: string[]; secondary?: string[] } | null,
              pattern: candidate.pattern,
              formality: candidate.formality,
            },
          ),
        }))
        .filter(({ score }) => score >= DUPLICATE_SCORE_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      possibleDuplicates = await Promise.all(
        scored.map(async ({ candidate, score }) => {
          const bucket = candidate.cutout_path ? "cutouts" : "originals";
          const path = candidate.cutout_path ?? candidate.original_photo_path;
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
          return {
            id: candidate.id,
            subcategory: candidate.subcategory,
            thumbnailUrl: signed?.signedUrl ?? null,
            score,
          };
        }),
      );

      if (possibleDuplicates.length > 0) {
        notices.push(
          `This looks similar to ${possibleDuplicates.length} item${possibleDuplicates.length === 1 ? "" : "s"} you already own (out of ${MAX_DUPLICATE_SCORE} match points) — check below before saving.`,
        );
      }
    }
  }

  return {
    status: "drafted",
    originalPhotoPath,
    cutoutPath,
    draft,
    notice: notices.length > 0 ? notices.join(" ") : null,
    possibleDuplicates,
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
