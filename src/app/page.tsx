import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

const SIGNED_URL_TTL_SECONDS = 300;

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
    .select("id, subcategory, added_date, cutout_path, original_photo_path, categories(name)")
    .eq("retired", false)
    .order("added_date", { ascending: false });

  const itemsWithThumbnails = await Promise.all(
    (items ?? []).map(async (item) => {
      const bucket = item.cutout_path ? "cutouts" : "originals";
      const path = item.cutout_path ?? item.original_photo_path;
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      return { ...item, thumbnailUrl: signed?.signedUrl ?? null };
    }),
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
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

      <Link
        href="/items/new"
        className="mb-6 rounded-full bg-black px-6 py-3 text-center text-base font-medium text-white"
      >
        Add an item
      </Link>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load your items: {error.message}
        </p>
      )}

      {!error && itemsWithThumbnails.length === 0 && (
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

      {!error && itemsWithThumbnails.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {itemsWithThumbnails.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-lg border border-neutral-200"
            >
              <div className="flex aspect-square items-center justify-center bg-neutral-50">
                {item.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnailUrl}
                    alt={item.subcategory ?? "Wardrobe item"}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-neutral-400">No photo</span>
                )}
              </div>
              <div className="p-2 text-sm">
                <p className="font-medium">{item.subcategory ?? "Untitled item"}</p>
                <p className="text-xs text-neutral-500">
                  {item.categories?.name ?? "Uncategorised"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
