-- Holiday-schedule app, moved in from its own Supabase project. Lives in the
-- `holiday` schema. Policies are copied unchanged from the old project.
create schema if not exists holiday;
grant usage on schema holiday to anon, authenticated, service_role;
alter default privileges in schema holiday grant all on tables to anon, authenticated, service_role;
alter default privileges in schema holiday grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema holiday grant execute on functions to anon, authenticated, service_role;

set search_path = holiday, extensions;

create table holiday.activities (id uuid default gen_random_uuid() not null, name text not null, date text not null, "time" text, location text, type text default 'activity'::text, created_at timestamp without time zone default now(), confirmed boolean default false, end_time text);
create table holiday.admins (id uuid default gen_random_uuid() not null, email text not null);
create table holiday.bh_price_snapshots (id bigint generated always as identity not null, checked_at timestamp with time zone default now() not null, source text default 'bodyholiday'::text not null, checkin date not null, nights integer not null, adults integer not null, rate_plan text, rate_id text, room_type text, room_id text, total_price numeric, currency text not null, availability_note text, status text not null, exchange_rate numeric, price_gbp numeric, price_per_night numeric generated always as (round((total_price / (nullif(nights, 0))::numeric), 2)) stored, price_per_night_gbp numeric generated always as (round((price_gbp / (nullif(nights, 0))::numeric), 2)) stored);
create table holiday.bh_settings (key text not null, value text not null);
create table holiday.chalkboard_images (id uuid default gen_random_uuid() not null, date date not null, image_url text not null, created_at timestamp with time zone default now());
create table holiday.historic_holiday_prices (id bigint generated always as identity not null, source text default 'bodyholiday'::text not null, booked_date date, check_in date not null, nights integer not null, checkout date generated always as ((check_in + nights)) stored, adults integer default 2 not null, room_canonical text, rate_plan text, price_total numeric, currency text default 'USD'::text not null, price_per_night numeric generated always as (round((price_total / (nullif(nights, 0))::numeric), 2)) stored, notes text, created_at timestamp with time zone default now() not null, includes_flights boolean default false not null, flights_price numeric, flights_booked_date date, flights_currency text, accommodation_price_usd numeric, accommodation_price_gbp numeric, flights_price_usd numeric, flights_price_gbp numeric, entry_type text default 'booking'::text not null);
create table holiday.price_tracker_day_rates (id bigint generated always as identity not null, snapshot_id bigint not null, room_canonical text, room_name_raw text not null, rate_plan_raw text, calendar_date date not null, price numeric, currency text, unavailable boolean default false not null, observed_at timestamp with time zone not null, lead_time_days integer not null, created_at timestamp with time zone default now() not null);
create table holiday.price_tracker_slots (id bigint generated always as identity not null, stay_id bigint not null, lead_bucket text not null, lead_offset_days integer not null, due_date date not null, status text default 'pending'::text not null, attempts integer default 0 not null, last_attempt_at timestamp with time zone);
create table holiday.price_tracker_snapshots (id bigint generated always as identity not null, stay_id bigint not null, slot_id bigint, observed_at timestamp with time zone default now() not null, lead_time_days integer not null, room_name_raw text not null, room_canonical text, rate_plan_raw text, price_total numeric, price_nightly numeric, price_label_raw text, currency text, availability text not null, raw_json jsonb, created_at timestamp with time zone default now() not null);
create table holiday.price_tracker_stays (id bigint generated always as identity not null, check_in date not null, nights integer not null, checkout date generated always as ((check_in + nights)) stored, source text default 'bodyholiday-avvio'::text not null, is_target boolean default false not null, created_at timestamp with time zone default now() not null, adults integer default 2 not null);
create table holiday.rsvps (id uuid default gen_random_uuid() not null, activity_id uuid, user_name text not null, created_at timestamp without time zone default now());
create table holiday.settings (key text not null, value text not null);
create table holiday.users (id uuid default gen_random_uuid() not null, name text not null, created_at timestamp without time zone default now(), sharing boolean default false not null, auth_user_id uuid, in_group boolean default false);

alter table holiday.activities add constraint activities_pkey1 primary key (id);
alter table holiday.admins add constraint admins_email_key unique (email);
alter table holiday.admins add constraint admins_pkey primary key (id);
alter table holiday.bh_price_snapshots add constraint bh_price_snapshots_pkey primary key (id);
alter table holiday.bh_settings add constraint bh_settings_pkey primary key (key);
alter table holiday.chalkboard_images add constraint chalkboard_images_date_key unique (date);
alter table holiday.chalkboard_images add constraint chalkboard_images_pkey primary key (id);
alter table holiday.historic_holiday_prices add constraint historic_holiday_prices_entry_type_check check ((entry_type = any (array['booking'::text, 'price_check'::text])));
alter table holiday.historic_holiday_prices add constraint historic_holiday_prices_pkey primary key (id);
alter table holiday.price_tracker_day_rates add constraint price_tracker_day_rates_pkey primary key (id);
alter table holiday.price_tracker_slots add constraint price_tracker_slots_pkey primary key (id);
alter table holiday.price_tracker_slots add constraint price_tracker_slots_status_check check ((status = any (array['pending'::text, 'done'::text, 'missed'::text, 'error'::text])));
alter table holiday.price_tracker_slots add constraint price_tracker_slots_stay_id_lead_bucket_key unique (stay_id, lead_bucket);
alter table holiday.price_tracker_snapshots add constraint price_tracker_snapshots_availability_check check ((availability = any (array['available'::text, 'sold_out'::text, 'min_stay'::text, 'unavailable'::text])));
alter table holiday.price_tracker_snapshots add constraint price_tracker_snapshots_pkey primary key (id);
alter table holiday.price_tracker_stays add constraint price_tracker_stays_check_in_nights_adults_source_key unique (check_in, nights, adults, source);
alter table holiday.price_tracker_stays add constraint price_tracker_stays_pkey primary key (id);
alter table holiday.rsvps add constraint rsvps_activity_id_user_name_key unique (activity_id, user_name);
alter table holiday.rsvps add constraint rsvps_pkey primary key (id);
alter table holiday.settings add constraint settings_pkey primary key (key);
alter table holiday.users add constraint users_name_key unique (name);
alter table holiday.users add constraint users_pkey primary key (id);
create index bh_snap_checked_at on holiday.bh_price_snapshots using btree (checked_at desc);
create index bh_snap_lookup on holiday.bh_price_snapshots using btree (checkin, room_id, rate_id, checked_at desc);
create index price_tracker_day_rates_date_idx on holiday.price_tracker_day_rates using btree (calendar_date);
create index price_tracker_day_rates_room_canonical_idx on holiday.price_tracker_day_rates using btree (room_canonical) where (room_canonical is not null);
create index price_tracker_day_rates_snapshot_idx on holiday.price_tracker_day_rates using btree (snapshot_id);
create index price_tracker_slots_due_status_idx on holiday.price_tracker_slots using btree (due_date, status);
create index price_tracker_snapshots_room_canonical_idx on holiday.price_tracker_snapshots using btree (room_canonical) where (room_canonical is not null);
create index price_tracker_snapshots_stay_idx on holiday.price_tracker_snapshots using btree (stay_id);
create unique index users_auth_user_id_idx on holiday.users using btree (auth_user_id) where (auth_user_id is not null);

alter table holiday.price_tracker_day_rates add constraint price_tracker_day_rates_snapshot_id_fkey foreign key (snapshot_id) references holiday.price_tracker_snapshots(id) on delete cascade;
alter table holiday.price_tracker_slots add constraint price_tracker_slots_stay_id_fkey foreign key (stay_id) references holiday.price_tracker_stays(id) on delete cascade;
alter table holiday.price_tracker_snapshots add constraint price_tracker_snapshots_slot_id_fkey foreign key (slot_id) references holiday.price_tracker_slots(id) on delete set null;
alter table holiday.price_tracker_snapshots add constraint price_tracker_snapshots_stay_id_fkey foreign key (stay_id) references holiday.price_tracker_stays(id) on delete cascade;
alter table holiday.rsvps add constraint rsvps_activity_id_fkey foreign key (activity_id) references holiday.activities(id) on delete cascade;
alter table holiday.users add constraint users_auth_user_id_fkey foreign key (auth_user_id) references auth.users(id) on delete set null;

create function holiday.bh_dashboard(p_pin text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'holiday'
as $function$
declare
  v_pin      text;
  v_room     text;
  v_checkin  date;
  v_nights   int;
  v_latest   timestamptz;
  result     jsonb;
begin
  select value into v_pin from bh_settings where key = 'dashboard_pin';
  if v_pin is null or p_pin is distinct from v_pin then
    perform pg_sleep(0.5);
    raise exception 'invalid_pin';
  end if;

  select value           into v_room    from bh_settings where key = 'target_room_pattern';
  select value::date     into v_checkin from bh_settings where key = 'target_checkin';
  select value::int      into v_nights  from bh_settings where key = 'target_nights';
  select max(checked_at) into v_latest  from bh_price_snapshots where status = 'priced';

  result := jsonb_build_object(
    'generated_at', now(),
    'target', jsonb_build_object(
      'room_pattern', v_room, 'checkin', v_checkin, 'nights', v_nights),
    'current', (
      select to_jsonb(t) from (
        select room_type, rate_plan, total_price, currency,
               availability_note, checked_at
        from bh_price_snapshots
        where status = 'priced'
          and checkin = v_checkin and nights = v_nights
          and room_type ilike v_room
          and checked_at = v_latest
        order by total_price asc
        limit 1
      ) t
    ),
    'history', (
      select coalesce(jsonb_agg(to_jsonb(h) order by h.day), '[]'::jsonb)
      from (
        select checked_at::date as day,
               min(total_price) as total_price,
               max(currency)    as currency
        from bh_price_snapshots
        where status = 'priced'
          and checkin = v_checkin and nights = v_nights
          and room_type ilike v_room
        group by checked_at::date
      ) h
    ),
    'june_overview', (
      select coalesce(jsonb_agg(to_jsonb(j) order by j.checkin), '[]'::jsonb)
      from (
        select distinct on (checkin)
               checkin, rate_plan, total_price, availability_note
        from bh_price_snapshots
        where status = 'priced'
          and nights = v_nights
          and room_type ilike v_room
          and checked_at = v_latest
        order by checkin, total_price asc
      ) j
    ),
    'available_rooms', (
      select coalesce(jsonb_agg(distinct room_type), '[]'::jsonb)
      from bh_price_snapshots
      where status = 'priced' and checked_at = v_latest
    )
  );

  return result;
end $function$;

create function holiday.bh_prices_publicly_readable()
 returns boolean
 language sql
 stable security definer
 set search_path to 'holiday'
as $function$
  select exists (
    select 1 from holiday.bh_settings
    where (key = 'nav_prices_public' or key = 'price_check_mode') and value = 'true'
  );
$function$;

create function holiday.bh_setting_is_true(setting_key text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'holiday'
as $function$
  select exists (
    select 1 from holiday.bh_settings where key = setting_key and value = 'true'
  );
$function$;

revoke execute on function holiday.bh_dashboard(text) from public;

create view holiday.bh_daily_best as  select distinct on (source, room_id, adults, checked_at) id,
    checked_at, source, checkin, nights, adults, rate_plan, rate_id, room_type, room_id, total_price,
    currency, availability_note, status, exchange_rate, price_gbp, price_per_night, price_per_night_gbp
   from holiday.bh_price_snapshots
  where (status = 'ok'::text)
  order by source, room_id, adults, checked_at, price_per_night_gbp;

create view holiday.bh_price_changes as  select id, checked_at, source, checkin, nights, adults, rate_plan, rate_id, room_type, room_id,
    total_price, currency, availability_note, status, exchange_rate, price_gbp, price_per_night, price_per_night_gbp,
    prev_price_per_night, prev_price_per_night_gbp
   from ( select b.id, b.checked_at, b.source, b.checkin, b.nights, b.adults, b.rate_plan, b.rate_id, b.room_type, b.room_id,
            b.total_price, b.currency, b.availability_note, b.status, b.exchange_rate, b.price_gbp, b.price_per_night, b.price_per_night_gbp,
            lag(b.price_per_night) over (partition by b.source, b.room_id, b.adults order by b.checked_at) as prev_price_per_night,
            lag(b.price_per_night_gbp) over (partition by b.source, b.room_id, b.adults order by b.checked_at) as prev_price_per_night_gbp
           from holiday.bh_daily_best b) t
  where ((prev_price_per_night_gbp is null) or (prev_price_per_night_gbp is distinct from price_per_night_gbp));

create view holiday.bh_price_drops as  with ranked as (
         select s.checkin, s.nights, s.adults, s.room_type, s.rate_plan, s.room_id, s.rate_id, s.total_price, s.currency, s.checked_at,
            dense_rank() over (partition by s.source, s.checkin, s.room_id, s.rate_id, s.adults order by s.checked_at desc) as rnk
           from holiday.bh_price_snapshots s
          where ((s.status = 'ok'::text) and (s.total_price is not null))
        )
 select latest.checkin, latest.room_type, latest.rate_plan, latest.currency,
    prev.total_price as prev_price, latest.total_price as latest_price,
    round(((100.0 * (latest.total_price - prev.total_price)) / prev.total_price), 1) as pct_change,
    latest.adults
   from (ranked latest
     join ranked prev on (((prev.checkin = latest.checkin) and (prev.room_id = latest.room_id) and (prev.rate_id = latest.rate_id) and (prev.adults = latest.adults) and (prev.rnk = 2))))
  where ((latest.rnk = 1) and (latest.total_price < prev.total_price));

alter table holiday.activities enable row level security;
create policy "Admins can delete activities" on holiday.activities for delete to authenticated using (true);
create policy "Anyone can read activities" on holiday.activities for select to anon using (true);
create policy "Authenticated users can insert activities" on holiday.activities for insert to authenticated with check (true);
create policy "Authenticated users can update activities" on holiday.activities for update to authenticated using (true) with check (true);
create policy "public delete activities" on holiday.activities for delete to public using (true);
create policy "public insert activities" on holiday.activities for insert to public with check (true);
create policy "public read activities" on holiday.activities for select to public using (true);
create policy "public update activities" on holiday.activities for update to public using (true) with check (true);
alter table holiday.admins enable row level security;
create policy "Admins readable by authenticated users" on holiday.admins for select to authenticated using (true);
alter table holiday.bh_price_snapshots enable row level security;
create policy "Anyone can read price snapshots when made public" on holiday.bh_price_snapshots for select to anon using (holiday.bh_prices_publicly_readable());
create policy "Authenticated users can read price snapshots" on holiday.bh_price_snapshots for select to authenticated using (true);
alter table holiday.bh_settings enable row level security;
create policy "Anyone can read the public-prices flag" on holiday.bh_settings for select to anon using (true);
create policy "Authenticated users can manage bh_settings" on holiday.bh_settings for all to authenticated using (true) with check (true);
alter table holiday.chalkboard_images enable row level security;
create policy "public delete chalkboard_images" on holiday.chalkboard_images for delete to public using (true);
create policy "public insert chalkboard_images" on holiday.chalkboard_images for insert to public with check (true);
create policy "public read chalkboard_images" on holiday.chalkboard_images for select to public using (true);
create policy "public update chalkboard_images" on holiday.chalkboard_images for update to public using (true) with check (true);
alter table holiday.historic_holiday_prices enable row level security;
create policy "Authenticated users can read historic holiday prices" on holiday.historic_holiday_prices for select to authenticated using (true);
alter table holiday.price_tracker_day_rates enable row level security;
create policy "Anyone can read day rates when prices are public" on holiday.price_tracker_day_rates for select to anon using (holiday.bh_prices_publicly_readable());
create policy "Authenticated users can read day rates" on holiday.price_tracker_day_rates for select to authenticated using (true);
alter table holiday.price_tracker_slots enable row level security;
create policy "Anyone can read slots when prices are public" on holiday.price_tracker_slots for select to anon using (holiday.bh_prices_publicly_readable());
create policy "Authenticated users can read slots" on holiday.price_tracker_slots for select to authenticated using (true);
alter table holiday.price_tracker_snapshots enable row level security;
create policy "Anyone can read snapshots when prices are public" on holiday.price_tracker_snapshots for select to anon using (holiday.bh_prices_publicly_readable());
create policy "Authenticated users can read snapshots" on holiday.price_tracker_snapshots for select to authenticated using (true);
alter table holiday.price_tracker_stays enable row level security;
create policy "Anyone can read stays when prices are public" on holiday.price_tracker_stays for select to anon using (holiday.bh_prices_publicly_readable());
create policy "Authenticated users can read stays" on holiday.price_tracker_stays for select to authenticated using (true);
alter table holiday.rsvps enable row level security;
create policy "public delete rsvps" on holiday.rsvps for delete to public using (true);
create policy "public insert rsvps" on holiday.rsvps for insert to public with check (true);
create policy "public read rsvps" on holiday.rsvps for select to public using (true);
alter table holiday.settings enable row level security;
create policy "public insert settings" on holiday.settings for insert to public with check (true);
create policy "public read settings" on holiday.settings for select to public using (true);
create policy "public update settings" on holiday.settings for update to public using (true) with check (true);
alter table holiday.users enable row level security;
create policy "Users can read own row" on holiday.users for select to authenticated using ((auth_user_id = auth.uid()));
create policy "public insert users" on holiday.users for insert to public with check (true);
create policy "public read users" on holiday.users for select to public using (true);
create policy "public update users" on holiday.users for update to public using (true) with check (true);

grant all on all tables in schema holiday to anon, authenticated, service_role;
grant all on all sequences in schema holiday to anon, authenticated, service_role;
grant execute on all functions in schema holiday to anon, authenticated, service_role;

insert into storage.buckets (id, name, public) values ('chalkboards', 'chalkboards', true), ('documents', 'documents', true) on conflict do nothing;
create policy "public delete chalkboards" on storage.objects for delete to public using ((bucket_id = 'chalkboards'::text));
create policy "public insert chalkboards" on storage.objects for insert to public with check ((bucket_id = 'chalkboards'::text));
create policy "public read chalkboards" on storage.objects for select to public using ((bucket_id = 'chalkboards'::text));
create policy "public update chalkboards" on storage.objects for update to public using ((bucket_id = 'chalkboards'::text)) with check ((bucket_id = 'chalkboards'::text));

reset search_path;
