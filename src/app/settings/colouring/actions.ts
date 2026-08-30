"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { analyzeColouringPhotos, type ColouringDraft } from "@/lib/anthropic/analyzeColouring";

export type AnalyzeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "drafted"; draft: ColouringDraft };

export async function analyzeColouringAction(
  _prevState: AnalyzeState,
  formData: FormData,
): Promise<AnalyzeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const photoPaths = formData
    .getAll("photoPath")
    .filter((v): v is string => typeof v === "string" && v !== "");
  if (photoPaths.length === 0) {
    return { status: "error", message: "Add at least one photo." };
  }

  const photos: Buffer[] = [];
  for (const path of photoPaths) {
    const { data: blob } = await supabase.storage.from("originals").download(path);
    if (blob) photos.push(Buffer.from(await blob.arrayBuffer()));
  }

  // These photos only exist to inform this one tentative read — never stored.
  await supabase.storage.from("originals").remove(photoPaths);

  let draft: ColouringDraft | null = null;
  try {
    draft = await analyzeColouringPhotos(photos);
  } catch (err) {
    return {
      status: "error",
      message: `Couldn't read those photos: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  if (!draft) {
    return { status: "error", message: "Auto-read is off (no ANTHROPIC_API_KEY set) — describe yourself manually below." };
  }

  return { status: "drafted", draft };
}

export type SaveColouringState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

function readList(formData: FormData, key: string): string[] {
  return (
    (formData.get(key) as string | null)
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}

function readText(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

export async function saveColouringProfileAction(
  _prevState: SaveColouringState,
  formData: FormData,
): Promise<SaveColouringState> {
  const supabase = await createClient();

  const profile = {
    undertone: readText(formData, "undertone"),
    hair: readText(formData, "hair"),
    eyes: readText(formData, "eyes"),
    notes: readText(formData, "notes"),
    flattering_colours: readList(formData, "flatteringColours"),
    unflattering_colours: readList(formData, "unflatteringColours"),
  };

  const { error } = await supabase.from("preferences").update({ colouring_profile: profile });

  if (error) {
    return { status: "error", message: `Couldn't save: ${error.message}` };
  }

  revalidatePath("/settings/colouring");
  return { status: "saved" };
}
