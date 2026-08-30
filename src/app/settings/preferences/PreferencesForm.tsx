"use client";

import { useActionState } from "react";
import {
  updatePreferencesAction,
  redistillAction,
  type UpdatePreferencesState,
  type RedistillState,
} from "./actions";

const initialSaveState: UpdatePreferencesState = { status: "idle" };
const initialRedistillState: RedistillState = { status: "idle" };

export default function PreferencesForm({
  stylePrinciples,
  occasionTags,
  namingPlayfulness,
}: {
  stylePrinciples: string[];
  occasionTags: string[];
  namingPlayfulness: string;
}) {
  const [saveState, saveFormAction, savePending] = useActionState(
    updatePreferencesAction,
    initialSaveState,
  );
  const [redistillState, redistillFormAction, redistillPending] = useActionState(
    redistillAction,
    initialRedistillState,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={saveFormAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Style principles (one per line)
          <textarea
            key={stylePrinciples.join("|")}
            name="stylePrinciples"
            rows={6}
            defaultValue={stylePrinciples.join("\n")}
            placeholder="e.g. Prefers muted, tonal colour pairings over bold contrast"
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
          <span className="text-xs text-neutral-500">
            What the app has learned (or you&apos;ve told it) about your style — edit or delete anything
            that&apos;s wrong.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Occasion tags (comma-separated)
          <input
            type="text"
            name="occasionTags"
            defaultValue={occasionTags.join(", ")}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Auto-naming style
          <select
            name="namingPlayfulness"
            defaultValue={namingPlayfulness}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          >
            <option value="plain">Plain — just the pieces</option>
            <option value="moderate">Moderate</option>
            <option value="playful">Playful</option>
          </select>
        </label>

        {saveState.status === "error" && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{saveState.message}</p>
        )}
        {saveState.status === "saved" && (
          <p className="text-sm text-green-700">✓ Saved</p>
        )}

        <button
          type="submit"
          disabled={savePending}
          className="rounded-full bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {savePending ? "Saving…" : "Save preferences"}
        </button>
      </form>

      <form action={redistillFormAction} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">Re-distill from feedback</p>
        <p className="text-xs text-neutral-500">
          Re-runs Claude over your recent suggestion feedback and replaces the style principles above —
          this overwrites any manual edits.
        </p>
        {redistillState.status === "error" && (
          <p className="text-sm text-red-700">{redistillState.message}</p>
        )}
        {redistillState.status === "done" && (
          <p className="text-sm text-green-700">
            ✓ Updated from your last {redistillState.count} feedback entries.
          </p>
        )}
        <button
          type="submit"
          disabled={redistillPending}
          className="self-start rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {redistillPending ? "Distilling…" : "Re-distill now"}
        </button>
      </form>
    </div>
  );
}
