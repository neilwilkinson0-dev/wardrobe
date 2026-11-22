#!/usr/bin/env bash
# One-off copy of one app's data (meetings, piano or holiday) from its old
# Supabase project into this (wardrobe) project, which hosts every app in its
# own schema. Move the apps one at a time.
#
# The schemas themselves already exist (supabase/migrations/20261019*, 20261122*).
# This script only moves rows and, for holiday, its logins and storage files.
#
# Needs: pg_dump/psql 17+, curl, python3.
#
# Usage (connection strings: the project's Connect button > Session pooler;
#        service role keys: Project Settings > API Keys):
#
#   export TARGET_DB_URL='postgresql://postgres.nvdcdghoiqmncregbknm:...@...pooler.supabase.com:5432/postgres'
#   export SOURCE_DB_URL='...the old project of the app being moved...'
#   bash supabase/consolidation/migrate-data.sh meetings     # or piano
#
#   # holiday also copies files, so it needs both projects' service role keys:
#   export TARGET_SERVICE_KEY='...'   # shared (wardrobe) project
#   export SOURCE_SERVICE_KEY='...'   # old holiday-schedule project
#   bash supabase/consolidation/migrate-data.sh holiday
#
# It refuses to touch a schema that already has rows, so it can't wipe data the
# app has written after the switch. Set FORCE=1 to empty the schema and copy
# again (only before that app is pointed at this project).
set -euo pipefail

APP=${1:-}
case "$APP" in
  meetings) SOURCE_REF=etcehyuywewsukksnhmf ;;
  piano)    SOURCE_REF=jochehygpypjbrrayxkc ;;
  holiday)  SOURCE_REF=kzdhgzeqylzxbfdputih ;;
  *) echo "Usage: $0 meetings|piano|holiday" >&2; exit 1 ;;
esac

: "${TARGET_DB_URL:?}" "${SOURCE_DB_URL:?}"
if [ "$APP" = holiday ]; then : "${TARGET_SERVICE_KEY:?}" "${SOURCE_SERVICE_KEY:?}"; fi

TARGET_REF=nvdcdghoiqmncregbknm
TARGET_URL="https://$TARGET_REF.supabase.co"
SOURCE_URL="https://$SOURCE_REF.supabase.co"

# Catch swapped or wrong connection strings before anything is written.
case "$SOURCE_DB_URL" in *"$SOURCE_REF"*) ;; *) echo "SOURCE_DB_URL is not the old $APP project ($SOURCE_REF)." >&2; exit 1 ;; esac
case "$TARGET_DB_URL" in *"$TARGET_REF"*) ;; *) echo "TARGET_DB_URL is not the shared project ($TARGET_REF)." >&2; exit 1 ;; esac

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

tgt() { psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -q "$@"; }
src() { psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 -q "$@"; }

row_count() {
  tgt -Atc "select coalesce(sum((xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int), 0)
            from information_schema.tables
            where table_schema = '$1' and table_type = 'BASE TABLE' and (table_schema, table_name) <> ('piano', 'owners')"
}

prepare_schema() {
  local schema=$1 n
  n=$(row_count "$schema")
  if [ "$n" != "0" ]; then
    if [ "${FORCE:-}" != "1" ]; then
      echo "Schema $schema already has $n rows. Re-run with FORCE=1 to empty it and copy again." >&2
      exit 1
    fi
    echo "Emptying $schema"
    tgt -c "do \$\$ declare t record; begin
              for t in select table_name from information_schema.tables
                       where table_schema = '$schema' and table_type = 'BASE TABLE' and ('$schema', table_name) <> ('piano', 'owners')
              loop execute format('truncate %I.%I restart identity cascade', '$schema', t.table_name); end loop;
            end \$\$;"
  fi
}

dump_public() {
  local schema=$1
  pg_dump "$SOURCE_DB_URL" --data-only --schema=public --no-owner --no-privileges \
    | sed -e "s/^COPY public\./COPY $schema./" \
          -e "s/pg_catalog\.setval('public\./pg_catalog.setval('$schema./" \
    > "$WORK/$schema.sql"
}

warn_if_files() {
  local n
  n=$(src -Atc "select count(*) from storage.objects")
  if [ "$n" != "0" ]; then
    echo "WARNING: the old $APP project has $n stored files that this script does not copy. Copy them before deleting that project." >&2
  fi
}

copy_simple() {
  echo "== $APP data"
  prepare_schema "$APP"
  dump_public "$APP"
  tgt --single-transaction -f "$WORK/$APP.sql" > /dev/null
  warn_if_files
}

copy_holiday() {
  # Holiday-schedule's users are copied with their ids, passwords and Google
  # links. Anyone who already exists here (matched by email) keeps their id
  # here, and holiday.users is pointed at it.
  echo "== holiday logins"
  prepare_schema holiday
  tgt -c "drop schema if exists migration_staging cascade;
          create schema migration_staging;
          create table migration_staging.users (like auth.users);
          create table migration_staging.identities (like auth.identities);" 2> /dev/null
  pg_dump "$SOURCE_DB_URL" --data-only --no-owner --no-privileges --table=auth.users --table=auth.identities \
    | sed -e "s/^COPY auth\./COPY migration_staging./" \
    > "$WORK/holiday_auth.sql"
  tgt --single-transaction -f "$WORK/holiday_auth.sql" > /dev/null

  tgt --single-transaction <<'SQL'
create table migration_staging.id_map as
  select s.id as old_id, coalesce(u.id, s.id) as new_id, u.id is null as is_new
  from migration_staging.users s
  left join auth.users u on lower(u.email) = lower(s.email);

do $$
declare
  user_cols text;
  ident_cols text;
  ident_select text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into user_cols
  from information_schema.columns c
  where c.table_schema = 'auth' and c.table_name = 'users' and c.is_generated = 'NEVER';

  execute format(
    'insert into auth.users (%s) select %s from migration_staging.users
     where id in (select old_id from migration_staging.id_map where is_new)',
    user_cols, user_cols);

  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position),
         string_agg(case when c.column_name = 'user_id' then 'm.new_id' else 'i.' || quote_ident(c.column_name) end, ', ' order by c.ordinal_position)
    into ident_cols, ident_select
  from information_schema.columns c
  where c.table_schema = 'auth' and c.table_name = 'identities' and c.is_generated = 'NEVER';

  -- New users get all their identities; existing users gain any sign-in method
  -- they only had in holiday-schedule (e.g. email + password).
  execute format(
    'insert into auth.identities (%s) select %s from migration_staging.identities i
     join migration_staging.id_map m on m.old_id = i.user_id
     on conflict do nothing',
    ident_cols, ident_select);
end $$;

-- Keep a holiday-schedule password for users who only had Google sign-in here.
update auth.users u
set encrypted_password = s.encrypted_password
from migration_staging.users s
join migration_staging.id_map m on m.old_id = s.id
where u.id = m.new_id and not m.is_new
  and coalesce(u.encrypted_password, '') = '' and coalesce(s.encrypted_password, '') <> '';

-- Inserting into auth.users fires wardrobe's starter-wardrobe trigger; holiday
-- people don't use wardrobe, so drop those starter rows again.
delete from public.categories where user_id in (select new_id from migration_staging.id_map where is_new);
delete from public.preferences where user_id in (select new_id from migration_staging.id_map where is_new);
SQL

  echo "== holiday data"
  dump_public holiday
  {
    echo "alter table holiday.users drop constraint users_auth_user_id_fkey;"
    cat "$WORK/holiday.sql"
    echo "update holiday.users h set auth_user_id = m.new_id from migration_staging.id_map m where h.auth_user_id = m.old_id;"
    echo "alter table holiday.users add constraint users_auth_user_id_fkey foreign key (auth_user_id) references auth.users(id) on delete set null;"
    echo "update holiday.chalkboard_images set image_url = replace(image_url, '$SOURCE_REF', '$TARGET_REF');"
    echo "update holiday.settings set value = replace(value, '$SOURCE_REF', '$TARGET_REF');"
    echo "update holiday.bh_settings set value = replace(value, '$SOURCE_REF', '$TARGET_REF');"
  } > "$WORK/holiday_load.sql"
  tgt --single-transaction -f "$WORK/holiday_load.sql" > /dev/null
  tgt -c "drop schema migration_staging cascade;" 2> /dev/null

  echo "== holiday files"
  src -At -F $'\t' -c "select bucket_id, name, coalesce(metadata->>'mimetype', 'application/octet-stream') from storage.objects order by 1, 2" \
    > "$WORK/objects.tsv"
  while IFS=$'\t' read -r bucket name mime; do
    path=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$name")
    curl -fsS -H "Authorization: Bearer $SOURCE_SERVICE_KEY" -H "apikey: $SOURCE_SERVICE_KEY" \
      "$SOURCE_URL/storage/v1/object/$bucket/$path" -o "$WORK/blob"
    curl -fsS -X POST -H "Authorization: Bearer $TARGET_SERVICE_KEY" -H "apikey: $TARGET_SERVICE_KEY" \
      -H "Content-Type: $mime" -H "x-upsert: true" --data-binary @"$WORK/blob" \
      "$TARGET_URL/storage/v1/object/$bucket/$path" > /dev/null
    echo "  $bucket/$name"
  done < "$WORK/objects.tsv"
}

if [ "$APP" = holiday ]; then copy_holiday; else copy_simple; fi

echo "== row counts (old project -> shared project)"
mismatches=0
while read -r table n; do
  m=$(tgt -Atc "select count(*) from $APP.$table")
  if [ "$n" = "$m" ]; then flag=ok; else flag=MISMATCH; mismatches=$((mismatches + 1)); fi
  printf '  %-28s %7s -> %-7s %s\n' "$table" "$n" "$m" "$flag"
done < <(src -At -F ' ' -c "select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', table_name), false, true, '')))[1]::text
                            from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1")
if [ "$mismatches" = 0 ]; then echo "Done: every table matches."; else echo "Done, but $mismatches tables differ (see above)." >&2; exit 1; fi
