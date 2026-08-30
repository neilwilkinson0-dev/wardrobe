"use client";

import { useActionState, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { describeSnapAction, logSnapWearAction, type SnapState } from "./actions";

const initialState: SnapState = { status: "idle" };

const ROLE_LABEL: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  footwear: "Footwear",
  outer_layer: "Outer layer",
};

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export default function SnapClient({ userId }: { userId: string }) {
  const [state, dispatch, pending] = useActionState(describeSnapAction, initialState);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);

    const photoFile = photoInputRef.current?.files?.[0];
    if (!photoFile) {
      setUploadError("A photo is required.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const photoPath = `${userId}/snap-${globalThis.crypto.randomUUID()}.${extensionFor(photoFile)}`;
      const { error } = await supabase.storage.from("originals").upload(photoPath, photoFile, {
        contentType: photoFile.type || "image/jpeg",
      });
      if (error) {
        setUploadError(`Couldn't upload photo: ${error.message}`);
        return;
      }

      const formData = new FormData();
      formData.set("photoPath", photoPath);
      dispatch(formData);
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || pending;

  if (state.status !== "described") {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Photo of today&apos;s outfit
          <input
            ref={photoInputRef}
            type="file"
            name="photo"
            accept="image/*"
            required
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
          {uploading ? "Uploading…" : pending ? "Matching…" : "Match to my wardrobe"}
        </button>
      </form>
    );
  }

  return (
    <form action={logSnapWearAction} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Date
        <input
          type="date"
          name="wornOn"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
      </label>

      {state.slots.map((slot) => (
        <fieldset key={slot.role} className="flex flex-col gap-2">
          <legend className="text-sm font-medium">
            {ROLE_LABEL[slot.role] ?? slot.role} — &ldquo;{slot.description}&rdquo;
          </legend>
          <div className="flex gap-3 overflow-x-auto">
            {slot.candidates.map((candidate, i) => (
              <label key={candidate.id} className="flex w-20 flex-shrink-0 flex-col items-center gap-1 text-center">
                <input
                  type="radio"
                  name={slot.role}
                  value={candidate.id}
                  defaultChecked={i === 0}
                  className="sr-only peer"
                />
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 peer-checked:border-2 peer-checked:border-black">
                  {candidate.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidate.thumbnailUrl}
                      alt={candidate.subcategory ?? "Candidate"}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-neutral-400">No photo</span>
                  )}
                </div>
                <span className="text-xs">{candidate.subcategory ?? "Item"}</span>
              </label>
            ))}
            <label className="flex w-20 flex-shrink-0 flex-col items-center gap-1 text-center">
              <input type="radio" name={slot.role} value="" className="sr-only peer" />
              <div className="flex h-20 w-20 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-xs text-neutral-500 peer-checked:border-2 peer-checked:border-black">
                None of these
              </div>
            </label>
          </div>
        </fieldset>
      ))}

      <button
        type="submit"
        className="rounded-full bg-black px-6 py-3 text-base font-medium text-white"
      >
        Log this wear
      </button>
    </form>
  );
}
