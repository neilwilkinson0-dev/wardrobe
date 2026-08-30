"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { quickAddItemAction, type QuickAddState } from "./actions";

const initialState: QuickAddState = { status: "idle" };

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

interface AddedItem {
  id: string;
}

export default function NewItemForm({ userId }: { userId: string }) {
  const [state, dispatch, pending] = useActionState(quickAddItemAction, initialState);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<AddedItem[]>([]);
  const garmentInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lastHandledItemId = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === "added" && state.itemId !== lastHandledItemId.current) {
      lastHandledItemId.current = state.itemId;
      setAddedItems((prev) => [{ id: state.itemId }, ...prev]);
      formRef.current?.reset();
    }
  }, [state]);

  const busy = uploading || pending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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

      const originalPhotoPath = `${userId}/${globalThis.crypto.randomUUID()}.${extensionFor(garmentFile)}`;
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
        labelPhotoPath = `${userId}/${globalThis.crypto.randomUUID()}.${extensionFor(labelFile)}`;
        const { error: labelUploadError } = await supabase.storage
          .from("originals")
          .upload(labelPhotoPath, labelFile, { contentType: labelFile.type || "image/jpeg" });
        if (labelUploadError) {
          labelPhotoPath = "";
        }
      }

      const formData = new FormData();
      formData.set("originalPhotoPath", originalPhotoPath);
      formData.set("labelPhotoPath", labelPhotoPath);
      dispatch(formData);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        {(uploadError || state.status === "error") && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            {uploadError ?? (state.status === "error" ? state.message : "")}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {uploading ? "Uploading…" : pending ? "Saving…" : "Add item"}
        </button>
      </form>

      {addedItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-neutral-700">
            Added {addedItems.length} item{addedItems.length === 1 ? "" : "s"} this session —
            classifying in the background.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {addedItems.map((item) => (
              <li key={item.id}>
                <Link href={`/items/${item.id}`} className="underline underline-offset-2">
                  View item
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/" className="text-center text-sm text-neutral-500 underline underline-offset-2">
        Done adding — back to wardrobe
      </Link>
    </div>
  );
}
