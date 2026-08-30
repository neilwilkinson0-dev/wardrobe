-- Seed sensible defaults (a preferences row + starter categories) the moment a new
-- Supabase Auth user is created, so a fresh login lands in a wardrobe that's already
-- usable rather than an empty shell needing setup.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.preferences (user_id)
  values (new.id);

  insert into public.categories (user_id, name, role, is_default) values
    (new.id, 'Tops', 'top', true),
    (new.id, 'Knitwear', 'top', true),
    (new.id, 'Trousers', 'bottom', true),
    (new.id, 'Coats', 'outer_layer', true),
    (new.id, 'Shoes', 'footwear', true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
