import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrowseClient, { type BrowseItem } from "./BrowseClient";

const SIGNED_URL_TTL_SECONDS = 300;

function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  return Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function BrowsePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("items")
    .select(
      "id, subcategory, colours, cutout_path, original_photo_path, classification_status, retired, categories(name)",
    )
    .order("added_date", { ascending: false });

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

  const browseItems: BrowseItem[] = await Promise.all(
    (items ?? []).map(async (item) => {
      const bucket = item.cutout_path ? "cutouts" : "originals";
      const path = item.cutout_path ?? item.original_photo_path;
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

      const colours = item.colours as { dominant?: string[]; secondary?: string[] } | null;
      const lastWorn = lastWornByItem.get(item.id) ?? null;

      return {
        id: item.id,
        subcategory: item.subcategory,
        categoryName: item.categories?.name ?? null,
        colours: [...(colours?.dominant ?? []), ...(colours?.secondary ?? [])],
        thumbnailUrl: signed?.signedUrl ?? null,
        pending: item.classification_status === "pending",
        retired: item.retired,
        daysSinceWorn: daysSince(lastWorn),
      };
    }),
  );

  const categoryNames = Array.from(
    new Set(browseItems.map((item) => item.categoryName).filter((name): name is string => !!name)),
  ).sort();

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Browse</h1>
        <Link href="/" className="text-sm text-neutral-500 underline underline-offset-2">
          Back to wardrobe
        </Link>
      </div>
      <BrowseClient items={browseItems} categoryNames={categoryNames} />
    </div>
  );
}
