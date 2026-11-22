-- Brings the holiday schema up to date with what holiday-schedule's old project
-- gained after 20261019000003 was written: the nightly price tracker tables,
-- views and functions. Copied as-is from the old project.
set search_path = holiday, extensions;

create table holiday.fx_rates (day date not null, usd_gbp numeric not null, fetched_at timestamp with time zone default now() not null);
create table holiday.price_alerts_sent (id bigint generated always as identity not null, kind text not null, key text not null, price numeric, detail jsonb, sent_at timestamp with time zone default now() not null);
create table holiday.price_nightly_latest (adults integer not null, room_canonical text not null, rate_plan text not null, calendar_date date not null, price numeric, currency text, status text not null, observed_at timestamp with time zone not null, lead_time_days integer not null);
create table holiday.price_sweep_runs (id bigint generated always as identity not null, started_at timestamp with time zone default now() not null, finished_at timestamp with time zone, trigger text, status text default 'running'::text not null, due integer, attempted integer default 0 not null, succeeded integer default 0 not null, failed integer default 0 not null, nights_updated integer default 0 not null, by_tier jsonb, errors jsonb, alerts_sent integer default 0 not null, alert_error text);

alter table holiday.fx_rates add constraint fx_rates_pkey primary key (day);
alter table holiday.price_alerts_sent add constraint price_alerts_sent_kind_check check ((kind = any (array['special'::text, 'price'::text])));
alter table holiday.price_alerts_sent add constraint price_alerts_sent_kind_key_key unique (kind, key);
alter table holiday.price_alerts_sent add constraint price_alerts_sent_pkey primary key (id);
alter table holiday.price_nightly_latest add constraint price_nightly_latest_pkey primary key (adults, room_canonical, rate_plan, calendar_date);
alter table holiday.price_nightly_latest add constraint price_nightly_latest_status_check check ((status = any (array['available'::text, 'restricted'::text, 'sold_out'::text, 'no_price'::text])));
alter table holiday.price_sweep_runs add constraint price_sweep_runs_pkey primary key (id);
alter table holiday.price_sweep_runs add constraint price_sweep_runs_status_check check ((status = any (array['running'::text, 'ok'::text, 'partial'::text, 'failed'::text])));
create index price_nightly_latest_date_idx on holiday.price_nightly_latest using btree (adults, calendar_date);
create index price_sweep_runs_started_idx on holiday.price_sweep_runs using btree (started_at desc);

create function holiday.price_baseline_prefix()
 returns text
 language sql
 stable
 set search_path to 'holiday'
as $function$
  select coalesce(
    nullif((select value::jsonb ->> 'baseline_plan' from settings where key = 'price_tracker'), ''),
    'Lowest Available Rate'
  );
$function$;

-- Note: this project is shared, so this now reports the size of every app's data.
create function holiday.price_db_size()
 returns bigint
 language sql
 stable security definer
 set search_path to 'holiday'
as $function$
  select pg_database_size(current_database());
$function$;

create view holiday.price_nights with (security_invoker=true) as  select dr.id,
    st.adults,
    dr.room_canonical,
    coalesce(dr.rate_plan_raw, ''::text) as rate_plan,
    dr.calendar_date,
    dr.price,
    dr.currency,
    dr.observed_at,
    dr.lead_time_days,
    st.check_in as block_start,
    st.nights as block_nights,
        case
            when dr.unavailable then 'sold_out'::text
            when (dr.price is null) then 'no_price'::text
            when (sn.availability = 'available'::text) then 'available'::text
            when (exists ( select 1
               from holiday.price_tracker_day_rates d2
              where ((d2.snapshot_id = dr.snapshot_id) and d2.unavailable))) then 'available'::text
            else 'restricted'::text
        end as status
   from ((holiday.price_tracker_day_rates dr
     join holiday.price_tracker_snapshots sn on ((sn.id = dr.snapshot_id)))
     join holiday.price_tracker_stays st on ((st.id = sn.stay_id)))
  where ((dr.room_canonical is not null) and (dr.calendar_date >= st.check_in) and (dr.calendar_date < (st.check_in + st.nights)));

create view holiday.price_curve with (security_invoker=true) as  select adults,
    room_canonical,
    rate_plan,
    (date_trunc('month'::text, (calendar_date)::timestamp with time zone))::date as stay_month,
    (lead_time_days / 7) as weeks_ahead,
    avg(price) as avg_price,
    count(*) as nights,
    min(currency) as currency
   from holiday.price_nights
  where ((price is not null) and (status <> 'sold_out'::text))
  group by adults, room_canonical, rate_plan, ((date_trunc('month'::text, (calendar_date)::timestamp with time zone))::date), (lead_time_days / 7);

create view holiday.price_nights_vs_baseline with (security_invoker=true) as  select n.id,
    n.adults,
    n.room_canonical,
    n.rate_plan,
    n.calendar_date,
    n.price,
    n.currency,
    n.observed_at,
    n.lead_time_days,
    n.block_start,
    n.block_nights,
    n.status,
    b.baseline_price
   from (holiday.price_nights n
     left join ( select price_nights.adults,
            price_nights.room_canonical,
            price_nights.calendar_date,
            price_nights.observed_at,
            min(price_nights.price) as baseline_price
           from holiday.price_nights
          where ((price_nights.rate_plan ~~ (holiday.price_baseline_prefix() || '%'::text)) and (price_nights.price is not null) and (price_nights.status <> 'sold_out'::text))
          group by price_nights.adults, price_nights.room_canonical, price_nights.calendar_date, price_nights.observed_at) b using (adults, room_canonical, calendar_date, observed_at))
  where ((n.price is not null) and (n.status <> 'sold_out'::text));

create view holiday.price_plan_nights with (security_invoker=true) as  select distinct on (adults, rate_plan, room_canonical, calendar_date) adults,
    rate_plan,
    room_canonical,
    calendar_date,
    price,
    currency,
    status,
    observed_at,
    baseline_price
   from holiday.price_nights_vs_baseline
  order by adults, rate_plan, room_canonical, calendar_date, observed_at desc;

create view holiday.price_plan_summary with (security_invoker=true) as  select adults,
    rate_plan,
    min(observed_at) as first_seen,
    max(observed_at) as last_seen,
    min(calendar_date) as first_night,
    max(calendar_date) as last_night,
    count(distinct calendar_date) as nights_covered,
    ((count(*) filter (where (status = 'restricted'::text)))::double precision / (count(*))::double precision) as restricted_share,
    avg(price) filter (where (baseline_price is not null)) as avg_price_matched,
    avg(baseline_price) as avg_baseline_matched,
    count(baseline_price) as matched_nights,
    (exists ( select 1
           from holiday.price_nightly_latest l
          where ((l.adults = n.adults) and (l.rate_plan = n.rate_plan) and (l.calendar_date >= current_date) and (l.status = any (array['available'::text, 'restricted'::text]))))) as live
   from holiday.price_nights_vs_baseline n
  group by adults, rate_plan;

create view holiday.price_blocks_status with (security_invoker=true) as  select st.id as stay_id,
    st.check_in,
    st.nights,
    st.adults,
    st.source,
    m.last_observed_at,
    l.had_rooms,
    st.is_target
   from ((holiday.price_tracker_stays st
     left join lateral ( select max(sn.observed_at) as last_observed_at
           from holiday.price_tracker_snapshots sn
          where (sn.stay_id = st.id)) m on (true))
     left join lateral ( select bool_or((sn.room_name_raw <> '(none)'::text)) as had_rooms
           from holiday.price_tracker_snapshots sn
          where ((sn.stay_id = st.id) and (sn.observed_at = m.last_observed_at))) l on (true));

create view holiday.price_fetches_daily with (security_invoker=true) as  select ((observed_at at time zone 'UTC'::text))::date as day,
        case
            when is_target then 'watched'::text
            when (lead <= 7) then '0-7'::text
            when (lead <= 14) then '8-14'::text
            when (lead <= 28) then '15-28'::text
            when (lead <= 91) then '29-91'::text
            else '92+'::text
        end as tier,
    count(*) as fetches
   from ( select distinct sn.stay_id,
            sn.observed_at,
            st.is_target,
            (st.check_in - ((sn.observed_at at time zone 'UTC'::text))::date) as lead
           from (holiday.price_tracker_snapshots sn
             join holiday.price_tracker_stays st on ((st.id = sn.stay_id)))
          where (sn.observed_at > (now() - '35 days'::interval))) f
  group by (((observed_at at time zone 'UTC'::text))::date),
        case
            when is_target then 'watched'::text
            when (lead <= 7) then '0-7'::text
            when (lead <= 14) then '8-14'::text
            when (lead <= 28) then '15-28'::text
            when (lead <= 91) then '29-91'::text
            else '92+'::text
        end;

create view holiday.price_watch_snapshots with (security_invoker=true) as  select b.id,
    b.checked_at,
    b.source,
    b.checkin,
    b.nights,
    b.adults,
    b.rate_plan,
    b.rate_id,
    b.room_type,
    b.room_id,
    b.total_price,
    b.currency,
    b.availability_note,
    b.status,
    b.exchange_rate,
    b.price_gbp,
    b.price_per_night,
    b.price_per_night_gbp
   from holiday.bh_price_snapshots b
union all
 select (- sn.id) as id,
    sn.observed_at as checked_at,
    'bodyholiday'::text as source,
    st.check_in as checkin,
    st.nights,
    st.adults,
    sn.rate_plan_raw as rate_plan,
    (sn.raw_json ->> 'rate_id'::text) as rate_id,
    sn.room_name_raw as room_type,
    (sn.raw_json ->> 'room_id'::text) as room_id,
    sn.price_total as total_price,
    sn.currency,
        case
            when (sn.room_name_raw = '(none)'::text) then 'No rooms listed — dates not on sale yet'::text
            else null::text
        end as availability_note,
        case
            when (sn.price_total is not null) then 'ok'::text
            else 'no_availability'::text
        end as status,
    fx.usd_gbp as exchange_rate,
    round((sn.price_total * fx.usd_gbp), 2) as price_gbp,
    round((sn.price_total / (st.nights)::numeric), 2) as price_per_night,
    round(((sn.price_total / (st.nights)::numeric) * fx.usd_gbp), 2) as price_per_night_gbp
   from ((holiday.price_tracker_snapshots sn
     join holiday.price_tracker_stays st on ((st.id = sn.stay_id)))
     left join lateral ( select
                case
                    when (sn.currency = 'GBP'::text) then (1)::numeric
                    else f.usd_gbp
                end as usd_gbp
           from holiday.fx_rates f
          where (f.day <= ((sn.observed_at at time zone 'UTC'::text))::date)
          order by f.day desc
         limit 1) fx on (true))
  where st.is_target;

create function holiday.price_rebuild_latest()
 returns void
 language sql
 security definer
 set search_path to 'holiday'
as $function$
  delete from price_nightly_latest where true;
  insert into price_nightly_latest (adults, room_canonical, rate_plan, calendar_date, price, currency, status, observed_at, lead_time_days)
  select adults, room_canonical, rate_plan, calendar_date, price, currency, status, observed_at, lead_time_days
  from (
    select n.*,
      max(n.observed_at) over (partition by n.adults, n.calendar_date) as night_latest,
      row_number() over (partition by n.adults, n.room_canonical, n.rate_plan, n.calendar_date order by n.observed_at desc, n.id desc) as rn
    from price_nights n
    where n.calendar_date >= current_date
  ) x
  where observed_at = night_latest and rn = 1;
$function$;

alter table holiday.fx_rates enable row level security;
create policy "Anyone can read exchange rates" on holiday.fx_rates for select to anon, authenticated using (true);
alter table holiday.price_alerts_sent enable row level security;
create policy "Authenticated users can read sent alerts" on holiday.price_alerts_sent for select to authenticated using (true);
alter table holiday.price_nightly_latest enable row level security;
create policy "Anyone can read latest nights when prices are public" on holiday.price_nightly_latest for select to anon using (holiday.bh_prices_publicly_readable());
create policy "Authenticated users can read latest nights" on holiday.price_nightly_latest for select to authenticated using (true);
alter table holiday.price_sweep_runs enable row level security;
create policy "Authenticated users can read sweep runs" on holiday.price_sweep_runs for select to authenticated using (true);

-- Execute rights as in the old project (the schema's defaults would grant more).
revoke execute on function holiday.price_db_size() from public, anon;
revoke execute on function holiday.price_rebuild_latest() from public, anon, authenticated;

reset search_path;
