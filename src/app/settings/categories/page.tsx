import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CategoriesManager from "./CategoriesManager";

export default async function CategoriesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("role")
    .order("name");

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Categories</h1>
        <Link href="/" className="text-sm text-neutral-500 underline underline-offset-2">
          Back to wardrobe
        </Link>
      </div>
      <CategoriesManager categories={categories ?? []} />
    </div>
  );
}
