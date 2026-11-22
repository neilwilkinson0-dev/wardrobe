-- Meetings app, moved in from its own Supabase project. Lives in the `meetings`
-- schema so it can share this project with the other apps.
create schema if not exists meetings;
grant usage on schema meetings to anon, authenticated, service_role;
alter default privileges in schema meetings grant all on tables to anon, authenticated, service_role;
alter default privileges in schema meetings grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema meetings grant execute on functions to anon, authenticated, service_role;

set search_path = meetings, extensions;

create table meetings.event_questions (id uuid default gen_random_uuid() not null, name text default ''::text not null, body text not null, status text default 'new'::text not null, created_at timestamp with time zone default now() not null);
create table meetings.event_sections (id uuid default gen_random_uuid() not null, "position" integer default 0 not null, kind text not null, title text default ''::text not null, subtitle text default ''::text not null, data jsonb default '{}'::jsonb not null, created_at timestamp with time zone default now() not null);
create table meetings.event_state (id integer default 1 not null, section_id uuid, step integer default 0 not null, data jsonb default '{}'::jsonb not null, updated_at timestamp with time zone default now() not null);
create table meetings.fun_questions (id uuid default gen_random_uuid() not null, option_a text, option_b text, created_at timestamp with time zone default now() not null, text text, source text default 'host'::text not null);
create table meetings.serious_questions (id uuid default gen_random_uuid() not null, text text not null, created_at timestamp with time zone default now() not null, source text default 'host'::text not null);
create table meetings.time_travel_entries (id uuid default gen_random_uuid() not null, round_id uuid not null, name text not null, idea text not null, created_at timestamp with time zone default now() not null);
create table meetings.time_travel_rounds (id uuid default gen_random_uuid() not null, question text not null, active boolean default true not null, started_at timestamp with time zone, created_at timestamp with time zone default now() not null);
create table meetings.wyr_people (id uuid default gen_random_uuid() not null, name text not null, created_at timestamp with time zone default now() not null);
create table meetings.wyr_questions (id uuid default gen_random_uuid() not null, option_a text not null, option_b text not null, created_at timestamp with time zone default now() not null);
create table meetings.wyr_responses (id uuid default gen_random_uuid() not null, session_id uuid not null, person_id uuid, person_name text not null, question_id uuid, option_a text not null, option_b text not null, choice text not null, created_at timestamp with time zone default now() not null);

alter table meetings.event_questions add constraint event_questions_pkey primary key (id);
alter table meetings.event_questions add constraint event_questions_status_check check ((status = any (array['new'::text, 'answered'::text, 'hidden'::text])));
alter table meetings.event_sections add constraint event_sections_pkey primary key (id);
alter table meetings.event_state add constraint event_state_id_check check ((id = 1));
alter table meetings.event_state add constraint event_state_pkey primary key (id);
alter table meetings.fun_questions add constraint fun_questions_pkey primary key (id);
alter table meetings.serious_questions add constraint serious_questions_pkey primary key (id);
alter table meetings.time_travel_entries add constraint time_travel_entries_pkey primary key (id);
alter table meetings.time_travel_rounds add constraint time_travel_rounds_pkey primary key (id);
alter table meetings.wyr_people add constraint wyr_people_pkey primary key (id);
alter table meetings.wyr_questions add constraint wyr_questions_pkey primary key (id);
alter table meetings.wyr_responses add constraint wyr_responses_choice_check check ((choice = any (array['a'::text, 'b'::text])));
alter table meetings.wyr_responses add constraint wyr_responses_pkey primary key (id);
create index time_travel_entries_round_id_idx on meetings.time_travel_entries using btree (round_id);

alter table meetings.event_state add constraint event_state_section_id_fkey foreign key (section_id) references meetings.event_sections(id) on delete set null;
alter table meetings.time_travel_entries add constraint time_travel_entries_round_id_fkey foreign key (round_id) references meetings.time_travel_rounds(id) on delete cascade;
alter table meetings.wyr_responses add constraint wyr_responses_person_id_fkey foreign key (person_id) references meetings.wyr_people(id) on delete set null;
alter table meetings.wyr_responses add constraint wyr_responses_question_id_fkey foreign key (question_id) references meetings.wyr_questions(id) on delete set null;

-- The meetings app has no logins; everything is open to the anon key, as before.
alter table meetings.event_questions enable row level security;
create policy "anon full access event_questions" on meetings.event_questions for all to public using (true) with check (true);
alter table meetings.event_sections enable row level security;
create policy "anon full access event_sections" on meetings.event_sections for all to public using (true) with check (true);
alter table meetings.event_state enable row level security;
create policy "anon full access event_state" on meetings.event_state for all to public using (true) with check (true);
alter table meetings.fun_questions enable row level security;
create policy "anon full access fun_questions" on meetings.fun_questions for all to public using (true) with check (true);
alter table meetings.serious_questions enable row level security;
create policy "anon full access serious_questions" on meetings.serious_questions for all to public using (true) with check (true);
alter table meetings.time_travel_entries enable row level security;
create policy "anon full access entries" on meetings.time_travel_entries for all to public using (true) with check (true);
alter table meetings.time_travel_rounds enable row level security;
create policy "anon full access rounds" on meetings.time_travel_rounds for all to public using (true) with check (true);
alter table meetings.wyr_people enable row level security;
create policy "anon all people" on meetings.wyr_people for all to public using (true) with check (true);
alter table meetings.wyr_questions enable row level security;
create policy "anon all questions" on meetings.wyr_questions for all to public using (true) with check (true);
alter table meetings.wyr_responses enable row level security;
create policy "anon insert responses" on meetings.wyr_responses for insert to public with check (true);
create policy "anon read responses" on meetings.wyr_responses for select to public using (true);

grant all on all tables in schema meetings to anon, authenticated, service_role;
grant all on all sequences in schema meetings to anon, authenticated, service_role;

alter publication supabase_realtime add table meetings.event_questions, meetings.event_sections, meetings.event_state, meetings.fun_questions, meetings.serious_questions;

insert into storage.buckets (id, name, public) values ('event-media', 'event-media', true) on conflict do nothing;
create policy "anon delete event-media" on storage.objects for delete to public using ((bucket_id = 'event-media'::text));
create policy "anon read event-media" on storage.objects for select to public using ((bucket_id = 'event-media'::text));
create policy "anon upload event-media" on storage.objects for insert to public with check ((bucket_id = 'event-media'::text));

reset search_path;
