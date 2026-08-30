"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  classifyItemAction,
  saveItemAction,
  type ClassifyState,
  type SaveState,
} from "./actions";
import type { FieldConfidence } from "@/lib/anthropic/classifyItem";

interface Category {
  id: string;
  name: string;
  role: string;
}

const ROLES = ["top", "bottom", "footwear", "outer_layer", "accessory"] as const;

const initialClassifyState: ClassifyState = { status: "idle" };
const initialSaveState: SaveState = { status: "idle" };

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function randomId(): string {
  // crypto.randomUUID is available in every browser this app targets, but
  // the "crypto" import above is Node's — use the Web Crypto global instead.
  return globalThis.crypto.randomUUID();
}

function ConfidenceBadge({ level }: { level?: FieldConfidence }) {
  if (!level) return null;
  return (
    <span
      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
        level === "solid"
          ? "bg-green-100 text-green-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {level === "solid" ? "from label" : "best guess"}
    </span>
  );
}

export default function NewItemForm({
  categories,
  userId,
}: {
  categories: Category[];
  userId: string;
}) {
  const [classifyState, classifyFormAction, classifyPending] = useActionState(
    classifyItemAction,
    initialClassifyState,
  );
  const [saveState, saveFormAction, savePending] = useActionState(
    saveItemAction,
    initialSaveState,
  );
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">("existing");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  async function handleClassifySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);

    const garmentFile = garmentInputRef.current?.files?.[0];
    if (!garmentFile) {
      setUploadError("A garment photo is required.");
      return;
    }
    const labelFile = labelInputRef.current?.files?.[0];

    setUploading(true);
    try {
      const supabase = createClient();

      const originalPhotoPath = `${userId}/${randomId()}.${extensionFor(garmentFile)}`;
      const { error: garmentUploadError } = await supabase.storage
        .from("originals")
        .upload(originalPhotoPath, garmentFile, {
          contentType: garmentFile.type || "image/jpeg",
        });
      if (garmentUploadError) {
        setUploadError(`Couldn't upload photo: ${garmentUploadError.message}`);
        return;
      }

      let labelPhotoPath = "";
      if (labelFile) {
        labelPhotoPath = `${userId}/${randomId()}.${extensionFor(labelFile)}`;
        const { error: labelUploadError } = await supabase.storage
          .from("originals")
          .upload(labelPhotoPath, labelFile, { contentType: labelFile.type || "image/jpeg" });
        if (labelUploadError) {
          // Non-fatal — proceed with garment-only classification.
          labelPhotoPath = "";
        }
      }

      const formData = new FormData();
      formData.set("originalPhotoPath", originalPhotoPath);
      formData.set("labelPhotoPath", labelPhotoPath);
      classifyFormAction(formData);
    } finally {
      setUploading(false);
    }
  }

  const draft = classifyState.status === "drafted" ? classifyState.draft : null;
  const confidence = draft?.confidence ?? {};

  const suggestedCategoryId = useMemo(() => {
    if (!draft) return "";
    const match = categories.find(
      (c) => c.name.toLowerCase() === draft.category_guess?.toLowerCase(),
    );
    return match?.id ?? "";
  }, [draft, categories]);

  if (classifyState.status !== "drafted") {
    const busy = uploading || classifyPending;
    return (
      <form onSubmit={handleClassifySubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Garment photo
          <input
            ref={garmentInputRef}
            type="file"
            name="garmentPhoto"
            accept="image/*"
            required
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Label photo (optional)
          <input
            ref={labelInputRef}
            type="file"
            name="labelPhoto"
            accept="image/*"
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>

        {(uploadError || classifyState.status === "error") && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            {uploadError ?? (classifyState.status === "error" ? classifyState.message : "")}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {uploading ? "Uploading…" : classifyPending ? "Classifying…" : "Classify garment"}
        </button>
      </form>
    );
  }

  return (
    <form action={saveFormAction} className="flex flex-col gap-4">
      <input type="hidden" name="originalPhotoPath" value={classifyState.originalPhotoPath} />
      <input type="hidden" name="cutoutPath" value={classifyState.cutoutPath ?? ""} />
      <input type="hidden" name="confidence" value={JSON.stringify(confidence)} />

      {classifyState.notice && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {classifyState.notice}
        </p>
      )}

      {classifyState.possibleDuplicates.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">Already in your wardrobe?</p>
          <div className="flex gap-3 overflow-x-auto">
            {classifyState.possibleDuplicates.map((dup) => (
              <Link
                key={dup.id}
                href={`/items/${dup.id}`}
                target="_blank"
                className="flex w-20 flex-shrink-0 flex-col items-center gap-1 text-center"
              >
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-amber-300 bg-white">
                  {dup.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dup.thumbnailUrl}
                      alt={dup.subcategory ?? "Similar item"}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-neutral-400">No photo</span>
                  )}
                </div>
                <span className="text-xs text-amber-900">{dup.subcategory ?? "Item"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Category</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={categoryMode === "existing"}
              onChange={() => setCategoryMode("existing")}
            />
            Existing
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={categoryMode === "new"}
              onChange={() => setCategoryMode("new")}
            />
            New category
          </label>
        </div>
        <input type="hidden" name="categoryMode" value={categoryMode} />

        {categoryMode === "existing" ? (
          <select
            name="existingCategoryId"
            defaultValue={suggestedCategoryId}
            required
            className="rounded-md border border-neutral-300 p-2 text-sm"
          >
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              name="newCategoryName"
              placeholder="Name"
              defaultValue={draft?.category_is_new ? draft.category_guess : ""}
              required
              className="flex-1 rounded-md border border-neutral-300 p-2 text-sm"
            />
            <select
              name="newCategoryRole"
              defaultValue={draft?.new_category_role ?? ""}
              required
              className="rounded-md border border-neutral-300 p-2 text-sm"
            >
              <option value="" disabled>
                Role
              </option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Subcategory
        <ConfidenceBadge level={confidence.subcategory} />
        <input
          type="text"
          name="subcategory"
          defaultValue={draft?.subcategory ?? ""}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Dominant colours
          <input
            type="text"
            name="coloursDominant"
            defaultValue={draft?.colours.dominant.join(", ") ?? ""}
            placeholder="navy, white"
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Secondary colours
          <input
            type="text"
            name="coloursSecondary"
            defaultValue={draft?.colours.secondary.join(", ") ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Pattern
          <ConfidenceBadge level={confidence.pattern} />
          <input
            type="text"
            name="pattern"
            defaultValue={draft?.pattern ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Formality
          <ConfidenceBadge level={confidence.formality} />
          <input
            type="text"
            name="formality"
            defaultValue={draft?.formality ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Silhouette
          <ConfidenceBadge level={confidence.silhouette} />
          <input
            type="text"
            name="silhouette"
            defaultValue={draft?.silhouette ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Season
          <ConfidenceBadge level={confidence.season_suitability} />
          <input
            type="text"
            name="seasonSuitability"
            defaultValue={draft?.season_suitability ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Material
          <ConfidenceBadge level={confidence.material} />
          <input
            type="text"
            name="material"
            defaultValue={draft?.material ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Care
          <ConfidenceBadge level={confidence.care} />
          <input
            type="text"
            name="care"
            defaultValue={draft?.care ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Brand
          <ConfidenceBadge level={confidence.brand} />
          <input
            type="text"
            name="brand"
            defaultValue={draft?.brand ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Size
          <ConfidenceBadge level={confidence.size} />
          <input
            type="text"
            name="size"
            defaultValue={draft?.size ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Price paid (optional)
        <input
          type="number"
          step="0.01"
          name="price"
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Where/when acquired (optional)
        <input
          type="text"
          name="acquiredNote"
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes (optional)
        <textarea
          name="notes"
          rows={2}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
      </label>

      {saveState.status === "error" && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {saveState.message}
        </p>
      )}

      <div className="flex gap-3">
        <Link
          href="/"
          className="flex-1 rounded-full border border-neutral-300 px-6 py-3 text-center text-base font-medium"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={savePending}
          className="flex-1 rounded-full bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {savePending ? "Saving…" : "Save item"}
        </button>
      </div>
    </form>
  );
}
