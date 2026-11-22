-- Piano app, moved in from its own Supabase project. Lives in the `piano` schema.
--
-- In its old project any signed-in user could write. This project's logins are
-- shared with the other apps, so writes are limited to the emails listed in
-- piano.owners instead. Public read access is unchanged.
create schema if not exists piano;
grant usage on schema piano to anon, authenticated, service_role;
alter default privileges in schema piano grant all on tables to anon, authenticated, service_role;
alter default privileges in schema piano grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema piano grant execute on functions to anon, authenticated, service_role;

set search_path = piano, extensions;

create table piano.owners (email text primary key);
alter table piano.owners enable row level security;
-- No policies: only the service role and SQL editor can change who owns the app.

create function piano.is_owner()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $$
  select exists (select 1 from piano.owners where email = lower(auth.jwt() ->> 'email'));
$$;

create sequence piano.metadata_properties_id_seq;
create sequence piano.metadata_property_values_id_seq;
create sequence piano.song_metadata_id_seq;

create table piano.app_settings (key text not null, value text not null, updated_at timestamp with time zone default now());
create table piano.chord_structure_versions (id bigint generated always as identity not null, chord_structure_id bigint not null, content text not null, saved_at timestamp with time zone default now() not null, saved_by text default 'neil'::text not null, label text);
create table piano.chord_structures (id bigint generated always as identity not null, name text default 'Untitled'::text not null, key_root text default 'C'::text not null, key_mode text default 'major'::text not null, sections jsonb default '[]'::jsonb not null, created_at timestamp with time zone default now(), rh_shape jsonb default '{"steps": [{"kind": "keyFifth"}]}'::jsonb not null, content text default ''::text not null, updated_at timestamp with time zone default now() not null, updated_by text default 'neil'::text not null, seed_text text default ''::text not null);
create table piano.forscore_ignored (filename text not null, created_at timestamp with time zone default now());
create table piano.forscore_setlists (id bigint generated always as identity not null, name text not null, filters jsonb default '[]'::jsonb not null, created_at timestamp with time zone default now(), source text default 'filters'::text not null);
create table piano.lyric_drafts (id bigint generated always as identity not null, name text default 'Untitled'::text not null, chord_structure_id bigint, seed_text text default ''::text not null, sections jsonb default '[]'::jsonb not null, created_at timestamp with time zone default now());
create table piano.metadata_properties (id integer default nextval('piano.metadata_properties_id_seq'::regclass) not null, name text not null, type text not null, display_order integer default 0 not null, show_as_stat_card boolean default false not null, created_at timestamp with time zone default now());
create table piano.metadata_property_values (id integer default nextval('piano.metadata_property_values_id_seq'::regclass) not null, property_id integer not null, value text not null, display_order integer default 0 not null);
create table piano.open_mic_events (id bigint generated always as identity not null, date date not null, venue text not null, notes text, created_at timestamp with time zone default now());
create table piano.open_mic_setlists (id bigint generated always as identity not null, event_id bigint, song_id bigint);
create table piano.playlist_syncs (id bigint generated always as identity not null, name text not null, filters jsonb default '[]'::jsonb not null, spotify_playlist_id text not null, spotify_playlist_name text not null, last_synced_at timestamp with time zone, last_song_count integer, created_at timestamp with time zone default now());
create table piano.setlist_generators (id bigint generated always as identity not null, name text not null, filters jsonb default '[]'::jsonb not null, created_at timestamp with time zone default now());
create table piano.song_ideas (id bigint generated always as identity not null, title text, body text, reference_url text, audio_path text, created_at timestamp with time zone default now());
create table piano.song_metadata (id integer default nextval('piano.song_metadata_id_seq'::regclass) not null, song_id bigint not null, property_id integer not null, value text not null, created_at timestamp with time zone default now());
create table piano.song_suggestions (id bigint generated always as identity not null, title text not null, artist text default ''::text not null, status text not null, created_at timestamp with time zone default now());
create table piano.songs (id bigint generated always as identity not null, title text not null, artist text not null, notes text, spotify_url text, tutorial_url text, ultimate_guitar_url text, created_at timestamp with time zone default now(), archived boolean default false not null, forscore_filename text, forscore_synced_at timestamp with time zone, musical_key text);

alter sequence piano.metadata_properties_id_seq owned by piano.metadata_properties.id;
alter sequence piano.metadata_property_values_id_seq owned by piano.metadata_property_values.id;
alter sequence piano.song_metadata_id_seq owned by piano.song_metadata.id;

alter table piano.app_settings add constraint app_settings_pkey primary key (key);
alter table piano.chord_structure_versions add constraint chord_structure_versions_pkey primary key (id);
alter table piano.chord_structures add constraint chord_structures_key_mode_check check ((key_mode = any (array['major'::text, 'minor'::text])));
alter table piano.chord_structures add constraint chord_structures_pkey primary key (id);
alter table piano.forscore_ignored add constraint forscore_ignored_pkey primary key (filename);
alter table piano.forscore_setlists add constraint forscore_setlists_pkey primary key (id);
alter table piano.forscore_setlists add constraint forscore_setlists_source_check check ((source = any (array['filters'::text, 'open_mic_history'::text])));
alter table piano.lyric_drafts add constraint lyric_drafts_pkey primary key (id);
alter table piano.metadata_properties add constraint metadata_properties_name_key unique (name);
alter table piano.metadata_properties add constraint metadata_properties_pkey primary key (id);
alter table piano.metadata_properties add constraint metadata_properties_type_check check ((type = any (array['free_text'::text, 'checkbox'::text, 'single_select'::text, 'multi_select'::text])));
alter table piano.metadata_property_values add constraint metadata_property_values_pkey primary key (id);
alter table piano.metadata_property_values add constraint metadata_property_values_property_id_value_key unique (property_id, value);
alter table piano.open_mic_events add constraint open_mic_events_pkey primary key (id);
alter table piano.open_mic_setlists add constraint open_mic_setlists_event_id_song_id_key unique (event_id, song_id);
alter table piano.open_mic_setlists add constraint open_mic_setlists_pkey primary key (id);
alter table piano.playlist_syncs add constraint playlist_syncs_pkey primary key (id);
alter table piano.setlist_generators add constraint setlist_generators_pkey primary key (id);
alter table piano.song_ideas add constraint song_ideas_pkey primary key (id);
alter table piano.song_metadata add constraint song_metadata_pkey primary key (id);
alter table piano.song_suggestions add constraint song_suggestions_pkey primary key (id);
alter table piano.song_suggestions add constraint song_suggestions_status_check check ((status = any (array['added'::text, 'dismissed'::text])));
alter table piano.song_suggestions add constraint song_suggestions_title_artist_key unique (title, artist);
alter table piano.songs add constraint songs_forscore_filename_key unique (forscore_filename);
alter table piano.songs add constraint songs_pkey primary key (id);
create index chord_structure_versions_song_idx on piano.chord_structure_versions using btree (chord_structure_id, saved_at desc);
create unique index song_metadata_single_value on piano.song_metadata using btree (song_id, property_id, value);

alter table piano.chord_structure_versions add constraint chord_structure_versions_chord_structure_id_fkey foreign key (chord_structure_id) references piano.chord_structures(id) on delete cascade;
alter table piano.lyric_drafts add constraint lyric_drafts_chord_structure_id_fkey foreign key (chord_structure_id) references piano.chord_structures(id) on delete set null;
alter table piano.metadata_property_values add constraint metadata_property_values_property_id_fkey foreign key (property_id) references piano.metadata_properties(id) on delete cascade;
alter table piano.open_mic_setlists add constraint open_mic_setlists_event_id_fkey foreign key (event_id) references piano.open_mic_events(id) on delete cascade;
alter table piano.open_mic_setlists add constraint open_mic_setlists_song_id_fkey foreign key (song_id) references piano.songs(id) on delete cascade;
alter table piano.song_metadata add constraint song_metadata_property_id_fkey foreign key (property_id) references piano.metadata_properties(id) on delete cascade;
alter table piano.song_metadata add constraint song_metadata_song_id_fkey foreign key (song_id) references piano.songs(id) on delete cascade;

-- Owner-only tables
alter table piano.app_settings enable row level security;
create policy "Owner can manage app_settings" on piano.app_settings for all to public using (piano.is_owner()) with check (piano.is_owner());
alter table piano.chord_structure_versions enable row level security;
create policy "Owner full access" on piano.chord_structure_versions for all to public using (piano.is_owner()) with check (piano.is_owner());
alter table piano.chord_structures enable row level security;
create policy "Owner full access" on piano.chord_structures for all to public using (piano.is_owner()) with check (piano.is_owner());
alter table piano.lyric_drafts enable row level security;
create policy "Owner full access" on piano.lyric_drafts for all to public using (piano.is_owner()) with check (piano.is_owner());
alter table piano.song_ideas enable row level security;
create policy "Owner full access" on piano.song_ideas for all to public using (piano.is_owner()) with check (piano.is_owner());

-- Public read, owner write
alter table piano.forscore_ignored enable row level security;
create policy "Owner can manage forscore_ignored" on piano.forscore_ignored for all to public using (piano.is_owner()) with check (piano.is_owner());
create policy "Public can read forscore_ignored" on piano.forscore_ignored for select to public using (true);
alter table piano.forscore_setlists enable row level security;
create policy "Owner can manage forscore_setlists" on piano.forscore_setlists for all to public using (piano.is_owner()) with check (piano.is_owner());
create policy "Public can read forscore_setlists" on piano.forscore_setlists for select to public using (true);
alter table piano.playlist_syncs enable row level security;
create policy "Owner can manage playlist_syncs" on piano.playlist_syncs for all to public using (piano.is_owner()) with check (piano.is_owner());
create policy "Public can read playlist_syncs" on piano.playlist_syncs for select to public using (true);
alter table piano.setlist_generators enable row level security;
create policy "Owner write access" on piano.setlist_generators for all to public using (piano.is_owner()) with check (piano.is_owner());
create policy "Public read access" on piano.setlist_generators for select to public using (true);
alter table piano.song_suggestions enable row level security;
create policy "Owner write access" on piano.song_suggestions for all to public using (piano.is_owner()) with check (piano.is_owner());
create policy "Public read access" on piano.song_suggestions for select to public using (true);

alter table piano.metadata_properties enable row level security;
create policy metadata_properties_owner_delete on piano.metadata_properties for delete to public using (piano.is_owner());
create policy metadata_properties_owner_update on piano.metadata_properties for update to public using (piano.is_owner());
create policy metadata_properties_owner_write on piano.metadata_properties for insert to public with check (piano.is_owner());
create policy metadata_properties_public_read on piano.metadata_properties for select to public using (true);
alter table piano.metadata_property_values enable row level security;
create policy metadata_property_values_owner_delete on piano.metadata_property_values for delete to public using (piano.is_owner());
create policy metadata_property_values_owner_update on piano.metadata_property_values for update to public using (piano.is_owner());
create policy metadata_property_values_owner_write on piano.metadata_property_values for insert to public with check (piano.is_owner());
create policy metadata_property_values_public_read on piano.metadata_property_values for select to public using (true);
alter table piano.open_mic_events enable row level security;
create policy open_mic_events_owner_delete on piano.open_mic_events for delete to public using (piano.is_owner());
create policy open_mic_events_owner_update on piano.open_mic_events for update to public using (piano.is_owner());
create policy open_mic_events_owner_write on piano.open_mic_events for insert to public with check (piano.is_owner());
create policy open_mic_events_public_read on piano.open_mic_events for select to public using (true);
alter table piano.open_mic_setlists enable row level security;
create policy open_mic_setlists_owner_delete on piano.open_mic_setlists for delete to public using (piano.is_owner());
create policy open_mic_setlists_owner_update on piano.open_mic_setlists for update to public using (piano.is_owner());
create policy open_mic_setlists_owner_write on piano.open_mic_setlists for insert to public with check (piano.is_owner());
create policy open_mic_setlists_public_read on piano.open_mic_setlists for select to public using (true);
alter table piano.song_metadata enable row level security;
create policy song_metadata_owner_delete on piano.song_metadata for delete to public using (piano.is_owner());
create policy song_metadata_owner_update on piano.song_metadata for update to public using (piano.is_owner());
create policy song_metadata_owner_write on piano.song_metadata for insert to public with check (piano.is_owner());
create policy song_metadata_public_read on piano.song_metadata for select to public using (true);
alter table piano.songs enable row level security;
create policy songs_owner_delete on piano.songs for delete to public using (piano.is_owner());
create policy songs_owner_update on piano.songs for update to public using (piano.is_owner());
create policy songs_owner_write on piano.songs for insert to public with check (piano.is_owner());
create policy songs_public_read on piano.songs for select to public using (true);

grant all on all tables in schema piano to anon, authenticated, service_role;
grant all on all sequences in schema piano to anon, authenticated, service_role;
grant execute on function piano.is_owner() to anon, authenticated, service_role;

insert into storage.buckets (id, name, public) values ('song-idea-audio', 'song-idea-audio', true) on conflict do nothing;
create policy "Piano owner delete audio" on storage.objects for delete to public using (((bucket_id = 'song-idea-audio'::text) and piano.is_owner()));
create policy "Piano owner upload audio" on storage.objects for insert to public with check (((bucket_id = 'song-idea-audio'::text) and piano.is_owner()));
create policy "Public read audio" on storage.objects for select to public using ((bucket_id = 'song-idea-audio'::text));

reset search_path;
