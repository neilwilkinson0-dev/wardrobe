import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PendingRefresher from "@/components/PendingRefresher";
import ItemCard, { type ItemCardData } from "@/components/ItemCard";
import { signOut } from "./actions";

const SIGNED_URL_TTL_SECONDS = 300;
const NEGLECTED_THRESHOLD_DAYS = 180;

function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  return Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

async function toCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  item: {
    id: string;
    subcategory: string | null;
    cutout_path: string | null;
    original_photo_path: string;
    classification_status: string;
    categories: { name: string } | null;
  },
): Promise<ItemCardData> {
  const bucket = item.cutout_path ? "cutouts" : "originals";
  const path = item.cutout_path ?? item.original_photo_path;
  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  return {
    id: item.id,
    subcategory: item.subcategory,
    categoryName: item.categories?.name ?? null,
    thumbnailUrl: signed?.signedUrl ?? null,
    pending: item.classification_status === "pending",
  };
}

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
    .select(
      "id, subcategory, added_date, cutout_path, original_photo_path, classification_status, categories(name)",
    )
    .eq("retired", false)
    .order("added_date", { ascending: false });

  const hasPending = (items ?? []).some((item) => item.classification_status === "pending");

  const { data: wearEvents } = await supabase
    .from("wear_events")
    .select("item_id, worn_on")
    .not("item_id", "is", null)
    .order("worn_on", { ascending: false });

  const lastWornByItem = new Map<string, string>();
  for (const event of wearEvents ?? []) {
    if (event.item_id && !lastWornByItem.has(event.item_id)) {
      lastWornByItem.set(event.item_id, event.worn_on);
    }
  }

  const all = items ?? [];
  const neglected = all
    .map((item) => ({ item, days: daysSince(lastWornByItem.get(item.id) ?? null) }))
    .filter(({ days }) => days >= NEGLECTED_THRESHOLD_DAYS)
    .sort((a, b) => b.days - a.days)
    .slice(0, 8)
    .map(({ item }) => item);

  const recent = all.slice(0, 6);

  const [neglectedCards, recentCards] = await Promise.all([
    Promise.all(neglected.map((item) => toCard(supabase, item))),
    Promise.all(recent.map((item) => toCard(supabase, item))),
  ]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6">
      <PendingRefresher active={hasPending} />
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Your wardrobe</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
          <Link href="/browse" className="text-sm text-neutral-500 underline underline-offset-2">
            Browse
          </Link>
          <Link href="/style" className="text-sm text-neutral-500 underline underline-offset-2">
            Style
          </Link>
          <Link
            href="/settings/preferences"
            className="text-sm text-neutral-500 underline underline-offset-2"
          >
            Preferences
          </Link>
          <Link href="/outfits" className="text-sm text-neutral-500 underline underline-offset-2">
            Outfits
          </Link>
          <Link href="/duplicates" className="text-sm text-neutral-500 underline underline-offset-2">
            Duplicates
          </Link>
          <Link
            href="/settings/categories"
            className="text-sm text-neutral-500 underline underline-offset-2"
          >
            Categories
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm text-neutral-500 underline underline-offset-2">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mb-6 flex gap-3">
        <Link
          href="/suggest"
          className="flex-1 rounded-full border border-black px-6 py-3 text-center text-base font-medium"
        >
          Today&apos;s suggestion
        </Link>
        <Link
          href="/items/new"
          className="flex-1 rounded-full bg-black px-6 py-3 text-center text-base font-medium text-white"
        >
          Add an item
        </Link>
      </div>

      <Link
        href="/wear/snap"
        className="mb-6 rounded-full border border-neutral-300 px-6 py-3 text-center text-base font-medium"
      >
        Log what I&apos;m wearing (photo)
      </Link>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load your items: {error.message}
        </p>
      )}

      {!error && all.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-neutral-500">
          <p className="text-base font-medium text-neutral-700">Nothing here yet</p>
          <p className="max-w-xs text-sm">
            Add your first item to start building a wardrobe that&apos;s provably yours — every item,
            outfit and photo is private to your account.
          </p>
        </div>
      )}

      {!error && all.length > 0 && (
        <div className="flex flex-col gap-6">
          {neglectedCards.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold">
                Haven&apos;t worn these in a while — maybe today?
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {neglectedCards.map((item) => (
                  <div key={item.id} className="w-28 flex-shrink-0">
                    <ItemCard item={item} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">Recently added</h2>
              <Link href="/browse" className="text-sm text-neutral-500 underline underline-offset-2">
                Browse all
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3">
              {recentCards.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
