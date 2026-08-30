-- Row-Level Security: every table is scoped to auth.uid(). No table is exempt.

alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.wear_events enable row level security;
alter table public.preferences enable row level security;
alter table public.feedback enable row level security;

create policy "categories_select_own" on public.categories for select using (user_id = auth.uid());
create policy "categories_insert_own" on public.categories for insert with check (user_id = auth.uid());
create policy "categories_update_own" on public.categories for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "categories_delete_own" on public.categories for delete using (user_id = auth.uid());

create policy "items_select_own" on public.items for select using (user_id = auth.uid());
create policy "items_insert_own" on public.items for insert with check (user_id = auth.uid());
create policy "items_update_own" on public.items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "items_delete_own" on public.items for delete using (user_id = auth.uid());

create policy "outfits_select_own" on public.outfits for select using (user_id = auth.uid());
create policy "outfits_insert_own" on public.outfits for insert with check (user_id = auth.uid());
create policy "outfits_update_own" on public.outfits for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "outfits_delete_own" on public.outfits for delete using (user_id = auth.uid());

create policy "outfit_items_select_own" on public.outfit_items for select using (user_id = auth.uid());
create policy "outfit_items_insert_own" on public.outfit_items for insert with check (user_id = auth.uid());
create policy "outfit_items_update_own" on public.outfit_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "outfit_items_delete_own" on public.outfit_items for delete using (user_id = auth.uid());

create policy "wear_events_select_own" on public.wear_events for select using (user_id = auth.uid());
create policy "wear_events_insert_own" on public.wear_events for insert with check (user_id = auth.uid());
create policy "wear_events_update_own" on public.wear_events for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "wear_events_delete_own" on public.wear_events for delete using (user_id = auth.uid());

create policy "preferences_select_own" on public.preferences for select using (user_id = auth.uid());
create policy "preferences_insert_own" on public.preferences for insert with check (user_id = auth.uid());
create policy "preferences_update_own" on public.preferences for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "preferences_delete_own" on public.preferences for delete using (user_id = auth.uid());

create policy "feedback_select_own" on public.feedback for select using (user_id = auth.uid());
create policy "feedback_insert_own" on public.feedback for insert with check (user_id = auth.uid());
create policy "feedback_update_own" on public.feedback for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "feedback_delete_own" on public.feedback for delete using (user_id = auth.uid());
