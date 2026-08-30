import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findVisualDuplicateGroups, type LabeledImage } from "@/lib/anthropic/findDuplicates";

const SIGNED_URL_TTL_SECONDS = 300;
const MAX_ITEMS_PER_CATEGORY = 15;

type Item = {
  id: string;
  subcategory: string | null;
  category_id: string | null;
  cutout_path: string | null;
  original_photo_path: string;
};

export default async function DuplicatesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("items")
    .select("id, subcategory, category_id, cutout_path, original_photo_path")
    .eq("retired", false);

  const all: Item[] = items ?? [];

  const byCategory = new Map<string, Item[]>();
  for (const item of all) {
    if (!item.category_id) continue;
    const list = byCategory.get(item.category_id) ?? [];
    list.push(item);
    byCategory.set(item.category_id, list);
  }

  const download = async (item: Item): Promise<Buffer | null> => {
    const bucket = item.cutout_path ? "cutouts" : "originals";
    const path = item.cutout_path ?? item.original_photo_path;
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  };

  const groups: Item[][] = [];
  let checkFailed = false;

  for (const categoryItems of byCategory.values()) {
    if (categoryItems.length < 2) continue;
    const batch = categoryItems.slice(0, MAX_ITEMS_PER_CATEGORY);

    const images: LabeledImage[] = [];
    const itemById = new Map<string, Item>();
    for (const item of batch) {
      const buffer = await download(item);
      if (buffer) {
        images.push({ label: item.id, buffer });
        itemById.set(item.id, item);
      }
    }

    try {
      const found = await findVisualDuplicateGroups(images);
      if (found === null) continue;
      for (const labelGroup of found) {
        const groupItems = labelGroup.map((id) => itemById.get(id)).filter((i): i is Item => !!i);
        if (groupItems.length >= 2) groups.push(groupItems);
      }
    } catch {
      checkFailed = true;
    }
  }

  const withThumbnails = await Promise.all(
    groups.map(async (group) => ({
      items: await Promise.all(
        group.map(async (item) => {
          const bucket = item.cutout_path ? "cutouts" : "originals";
          const path = item.cutout_path ?? item.original_photo_path;
          const { data: signed } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
          return { ...item, thumbnailUrl: signed?.signedUrl ?? null };
        }),
      ),
    })),
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Possible duplicates</h1>
        <Link href="/" className="text-sm text-neutral-500 underline underline-offset-2">
          Back to wardrobe
        </Link>
      </div>

      <p className="mb-4 text-sm text-neutral-500">
        Photos of same-category items are compared directly for visual similarity — same
        or near-identical garments are grouped below.
      </p>

      {checkFailed && (
        <p className="mb-4 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Some categories couldn&apos;t be checked (the duplicate check failed) — this list
          may be incomplete.
        </p>
      )}

      {withThumbnails.length === 0 && !checkFailed && (
        <p className="text-sm text-neutral-500">
          Nothing flagged — no two items in the same category look like the same garment.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {withThumbnails.map(({ items: groupItems }) => (
          <li
            key={groupItems.map((i) => i.id).join("-")}
            className="flex items-center gap-3 overflow-x-auto rounded-lg border border-neutral-200 p-3"
          >
            {groupItems.map((item) => (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className="flex flex-1 flex-shrink-0 flex-col items-center gap-1 text-center"
              >
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md bg-neutral-50">
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
                <span className="text-xs">{item.subcategory ?? "Item"}</span>
              </Link>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
