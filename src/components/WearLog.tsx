"use client";

import { useActionState } from "react";

export interface WearEvent {
  id: string;
  worn_on: string;
}

export type LogWearState =
  | { status: "idle" }
  | { status: "logged"; date: string }
  | { status: "error"; message: string };

export const initialLogWearState: LogWearState = { status: "idle" };

export default function WearLog({
  hiddenFields,
  events,
  logAction,
  deleteAction,
}: {
  hiddenFields: Record<string, string>;
  events: WearEvent[];
  logAction: (prevState: LogWearState, formData: FormData) => Promise<LogWearState>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(logAction, initialLogWearState);

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="mb-3 text-sm text-neutral-600">
        {events.length === 0
          ? "Never logged as worn."
          : `Worn ${events.length} time${events.length === 1 ? "" : "s"} · last on ${events[0].worn_on}`}
      </p>

      <form action={formAction} className="flex gap-2">
        {Object.entries(hiddenFields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <input
          type="date"
          name="wornOn"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="flex-1 rounded-md border border-neutral-300 p-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Logging…" : "Log a wear"}
        </button>
      </form>

      {state.status === "logged" && (
        <p className="mt-2 text-sm text-green-700">✓ Logged for {state.date}</p>
      )}
      {state.status === "error" && (
        <p className="mt-2 text-sm text-red-700">{state.message}</p>
      )}

      {events.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {events.map((event) => (
            <li key={event.id} className="flex items-center justify-between text-xs text-neutral-500">
              <span>{event.worn_on}</span>
              <form action={deleteAction}>
                {Object.entries(hiddenFields).map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
                <input type="hidden" name="wearEventId" value={event.id} />
                <button type="submit" className="text-red-600 underline underline-offset-2">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
