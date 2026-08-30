import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { scoreDuplicate, DUPLICATE_SCORE_THRESHOLD, MAX_DUPLICATE_SCORE } from "@/lib/duplicates/score";

const SIGNED_URL_TTL_SECONDS = 300;

export default async function DuplicatesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("items")
    .select("id, subcategory, category_id, colours, pattern, formality, cutout_path, original_photo_path")
    .eq("retired", false);

  const all = items ?? [];

  const pairs: { a: (typeof all)[number]; b: (typeof all)[number]; score: number }[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const score = scoreDuplicate(
        {
          category_id: a.category_id,
          colours: a.colours as { dominant?: string[]; secondary?: string[] } | null,
          pattern: a.pattern,
          formality: a.formality,
        },
        {
          category_id: b.category_id,
          colours: b.colours as { dominant?: string[]; secondary?: string[] } | null,
          pattern: b.pattern,
          formality: b.formality,
        },
      );
      if (score >= DUPLICATE_SCORE_THRESHOLD) pairs.push({ a, b, score });
    }
  }
  pairs.sort((p, q) => q.score - p.score);

  const withThumbnails = await Promise.all(
    pairs.map(async (pair) => {
      const thumb = async (item: (typeof all)[number]) => {
        const bucket = item.cutout_path ? "cutouts" : "originals";
        const path = item.cutout_path ?? item.original_photo_path;
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        return signed?.signedUrl ?? null;
      };
      return {
        ...pair,
        aThumbnail: await thumb(pair.a),
        bThumbnail: await thumb(pair.b),
      };
    }),
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Possible duplicates</h1>
        <Link href="/" className="text-sm text-neutral-500 underline underline-offset-2">
          Back to wardrobe
        </Link>
      </div>

      {withThumbnails.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nothing flagged — no two items in the same category share enough colours,
          pattern or formality to look like duplicates.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {withThumbnails.map(({ a, b, score, aThumbnail, bThumbnail }) => (
          <li
            key={`${a.id}-${b.id}`}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3"
          >
            {[
              { item: a, thumbnail: aThumbnail },
              { item: b, thumbnail: bThumbnail },
            ].map(({ item, thumbnail }) => (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className="flex flex-1 flex-col items-center gap-1 text-center"
              >
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md bg-neutral-50">
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnail}
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
            <span className="text-xs text-neutral-500">
              {score}/{MAX_DUPLICATE_SCORE}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
