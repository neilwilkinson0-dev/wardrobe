-- Wardrobe app core schema.
-- Every table is user-scoped (user_id -> auth.users) and RLS-locked in the next migration.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  name text not null,
  role text not null check (role in ('top','bottom','footwear','outer_layer','accessory')),
  is_default boolean not null default false,
  unique (user_id, name)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  category_id uuid references public.categories(id) on delete set null,

  -- Visual (auto, from garment photo)
  subcategory text,
  colours jsonb,
  pattern text,
  formality text,
  silhouette text,
  season_suitability text,

  -- Factual (auto, from label photo if present)
  material text,
  care text,
  brand text,
  size text,

  -- User-optional context
  price numeric,
  acquired_note text,
  notes text,

  -- Assets
  original_photo_path text not null,
  cutout_path text,

  -- Per-field confidence flags: which values are label-sourced/solid vs garment-guessed/tentative
  confidence jsonb,

  added_date date not null default current_date,
  retired boolean not null default false
);

create index items_user_id_idx on public.items (user_id);
create index items_category_id_idx on public.items (category_id);

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  name text not null,
  rating int check (rating between 1 and 5),
  saved_date date not null default current_date,
  last_worn_date date,
  source text not null default 'manual' check (source in ('suggested', 'manual'))
);

create index outfits_user_id_idx on public.outfits (user_id);

create table public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  unique (outfit_id, item_id)
);

create index outfit_items_outfit_id_idx on public.outfit_items (outfit_id);
create index outfit_items_item_id_idx on public.outfit_items (item_id);

create table public.wear_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  item_id uuid references public.items(id) on delete cascade,
  outfit_id uuid references public.outfits(id) on delete cascade,
  worn_on date not null,
  weather jsonb,
  occasion text,
  constraint wear_events_has_target check (item_id is not null or outfit_id is not null)
);

create index wear_events_user_id_idx on public.wear_events (user_id);
create index wear_events_item_id_idx on public.wear_events (item_id);
create index wear_events_outfit_id_idx on public.wear_events (outfit_id);
create index wear_events_worn_on_idx on public.wear_events (worn_on);

create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  style_principles jsonb,
  occasion_tags text[] not null default array['WFH','office','going out','gig/performing','dressy','normal day'],
  colouring_profile jsonb,
  naming_playfulness text not null default 'moderate'
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  suggestion_ref jsonb,
  rating int,
  quick_reasons text[],
  freeform text,
  context jsonb
);

create index feedback_user_id_idx on public.feedback (user_id);
