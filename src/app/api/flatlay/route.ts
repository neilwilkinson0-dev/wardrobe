import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { composeFlatlay } from "@/lib/suggestions/flatlay";

async function downloadItemImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
): Promise<Buffer | null> {
  const { data: item } = await supabase
    .from("items")
    .select("cutout_path, original_photo_path")
    .eq("id", itemId)
    .single();

  if (!item) return null;

  const bucket = item.cutout_path ? "cutouts" : "originals";
  const path = item.cutout_path ?? item.original_photo_path;

  const { data: blob, error } = await supabase.storage.from(bucket).download(path);
  if (error || !blob) return null;

  return Buffer.from(await blob.arrayBuffer());
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const topId = searchParams.get("top");
  const bottomId = searchParams.get("bottom");
  const footwearId = searchParams.get("footwear");
  const outerId = searchParams.get("outer");

  if (!topId || !bottomId || !footwearId) {
    return new NextResponse("Missing top, bottom or footwear item id", { status: 400 });
  }

  const [topBuffer, bottomBuffer, footwearBuffer, outerBuffer] = await Promise.all([
    downloadItemImage(supabase, topId),
    downloadItemImage(supabase, bottomId),
    downloadItemImage(supabase, footwearId),
    outerId ? downloadItemImage(supabase, outerId) : Promise.resolve(null),
  ]);

  if (!topBuffer || !bottomBuffer || !footwearBuffer) {
    return new NextResponse("Couldn't load one or more item photos", { status: 404 });
  }

  const png = await composeFlatlay({
    top: topBuffer,
    bottom: bottomBuffer,
    footwear: footwearBuffer,
    outer: outerBuffer,
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
