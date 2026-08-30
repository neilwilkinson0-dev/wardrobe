-- Private storage for garment photos. Two buckets, both private; objects are stored
-- under a `${user_id}/...` prefix and access is scoped to that prefix so a user can
-- only ever read/write their own files.

insert into storage.buckets (id, name, public)
values ('originals', 'originals', false), ('cutouts', 'cutouts', false)
on conflict (id) do nothing;

create policy "originals_select_own"
  on storage.objects for select
  using (bucket_id = 'originals' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "originals_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'originals' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "originals_update_own"
  on storage.objects for update
  using (bucket_id = 'originals' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'originals' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "originals_delete_own"
  on storage.objects for delete
  using (bucket_id = 'originals' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "cutouts_select_own"
  on storage.objects for select
  using (bucket_id = 'cutouts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "cutouts_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'cutouts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "cutouts_update_own"
  on storage.objects for update
  using (bucket_id = 'cutouts' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'cutouts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "cutouts_delete_own"
  on storage.objects for delete
  using (bucket_id = 'cutouts' and auth.uid()::text = (storage.foldername(name))[1]);
