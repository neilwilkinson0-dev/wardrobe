"use client";

import { useActionState, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  analyzeColouringAction,
  saveColouringProfileAction,
  type AnalyzeState,
  type SaveColouringState,
} from "./actions";

interface Profile {
  undertone: string | null;
  hair: string | null;
  eyes: string | null;
  notes: string | null;
  flattering_colours: string[];
  unflattering_colours: string[];
}

const initialAnalyzeState: AnalyzeState = { status: "idle" };
const initialSaveState: SaveColouringState = { status: "idle" };

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export default function ColouringForm({ userId, profile }: { userId: string; profile: Profile }) {
  const [analyzeState, analyzeDispatch, analyzePending] = useActionState(
    analyzeColouringAction,
    initialAnalyzeState,
  );
  const [saveState, saveFormAction, savePending] = useActionState(
    saveColouringProfileAction,
    initialSaveState,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Rather than mirroring analyzeState into local state via an effect, these
  // fields just remount (via `key`) with fresh defaultValues whenever a new
  // draft arrives — the standard way to reset uncontrolled inputs from an
  // external event without cascading setState-in-effect renders.
  const draftKey = analyzeState.status === "drafted" ? JSON.stringify(analyzeState.draft) : "initial";
  const undertoneDefault =
    analyzeState.status === "drafted" ? (analyzeState.draft.undertone ?? "") : (profile.undertone ?? "");
  const flatteringDefault =
    analyzeState.status === "drafted"
      ? analyzeState.draft.flattering_colours.join(", ")
      : profile.flattering_colours.join(", ");
  const unflatteringDefault =
    analyzeState.status === "drafted"
      ? analyzeState.draft.unflattering_colours.join(", ")
      : profile.unflattering_colours.join(", ");

  async function handleAnalyzeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);

    const files = Array.from(photoInputRef.current?.files ?? []);
    if (files.length === 0) {
      setUploadError("Add at least one photo.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const formData = new FormData();

      for (const file of files) {
        const path = `${userId}/colouring-${globalThis.crypto.randomUUID()}.${extensionFor(file)}`;
        const { error } = await supabase.storage.from("originals").upload(path, file, {
          contentType: file.type || "image/jpeg",
        });
        if (error) {
          setUploadError(`Couldn't upload photo: ${error.message}`);
          return;
        }
        formData.append("photoPath", path);
      }

      analyzeDispatch(formData);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleAnalyzeSubmit}
        className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4"
      >
        <p className="text-sm font-medium">Optional: tentative read from photos</p>
        <p className="text-xs text-neutral-500">
          A couple of photos in good natural light. This only ever pre-fills the fields below for you
          to confirm or change — nothing saves automatically.
        </p>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
        {(uploadError || analyzeState.status === "error") && (
          <p className="text-sm text-red-700">
            {uploadError ?? (analyzeState.status === "error" ? analyzeState.message : "")}
          </p>
        )}
        {analyzeState.status === "drafted" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {analyzeState.draft.notes}
          </p>
        )}
        <button
          type="submit"
          disabled={uploading || analyzePending}
          className="self-start rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {uploading ? "Uploading…" : analyzePending ? "Reading…" : "Get tentative read"}
        </button>
      </form>

      <form action={saveFormAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Undertone
          <select
            key={draftKey}
            name="undertone"
            defaultValue={undertoneDefault}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          >
            <option value="">Not sure</option>
            <option value="cool">Cool</option>
            <option value="warm">Warm</option>
            <option value="neutral">Neutral</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Hair colour
            <input
              type="text"
              name="hair"
              defaultValue={profile.hair ?? ""}
              className="rounded-md border border-neutral-300 p-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Eye colour
            <input
              type="text"
              name="eyes"
              defaultValue={profile.eyes ?? ""}
              className="rounded-md border border-neutral-300 p-2 text-sm"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Colours that suit you
          <input
            key={draftKey}
            type="text"
            name="flatteringColours"
            defaultValue={flatteringDefault}
            placeholder="navy, emerald, cool pink"
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Colours that don&apos;t suit you
          <input
            key={draftKey}
            type="text"
            name="unflatteringColours"
            defaultValue={unflatteringDefault}
            placeholder="camel, orange"
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Notes
          <textarea
            name="notes"
            rows={2}
            defaultValue={profile.notes ?? ""}
            placeholder='e.g. "camel washes me out"'
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>

        {saveState.status === "error" && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{saveState.message}</p>
        )}
        {saveState.status === "saved" && <p className="text-sm text-green-700">✓ Saved</p>}

        <button
          type="submit"
          disabled={savePending}
          className="rounded-full bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {savePending ? "Saving…" : "Save colouring profile"}
        </button>
      </form>
    </div>
  );
}
