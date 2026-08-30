import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SnapClient from "./SnapClient";

// A single vision call to describe the outfit — not backgrounded like
// add-item, since the user is waiting on it to confirm matches.
export const maxDuration = 30;

export default async function SnapPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Log by photo</h1>
        <Link href="/" className="text-sm text-neutral-500 underline underline-offset-2">
          Back to wardrobe
        </Link>
      </div>
      <SnapClient userId={user.id} />
    </div>
  );
}
