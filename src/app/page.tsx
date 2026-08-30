import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function WardrobePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: items, error } = await supabase
    .from("items")
    .select("id, subcategory, added_date")
    .order("added_date", { ascending: false });

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Your wardrobe</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-neutral-500 underline underline-offset-2"
          >
            Sign out
          </button>
        </form>
      </header>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load your items: {error.message}
        </p>
      )}

      {!error && items && items.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-neutral-500">
          <p className="text-base font-medium text-neutral-700">
            Nothing here yet
          </p>
          <p className="max-w-xs text-sm">
            Add your first item to start building a wardrobe that&apos;s
            provably yours — every item, outfit and photo is private to your
            account.
          </p>
        </div>
      )}

      {!error && items && items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-neutral-200 p-3 text-sm"
            >
              {item.subcategory ?? "Untitled item"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
