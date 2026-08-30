import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewItemForm from "./NewItemForm";

export default async function NewItemPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, role")
    .order("name");

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold">Add an item</h1>
      <NewItemForm categories={categories ?? []} userId={user.id} />
    </div>
  );
}
