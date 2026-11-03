-- Brotkarte Hannover – Datenbank-Setup für Supabase
-- Einmal komplett im Supabase-Dashboard unter "SQL Editor" ausführen.
-- Das Skript kann gefahrlos mehrfach laufen.

-- Anzeigenamen der Personen (wer hat was eingetragen)
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  updated_at timestamptz not null default now()
);

-- Bäckereien mit Position auf der Karte
create table if not exists public.bakeries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  address    text,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  osm_id     text,                                   -- z. B. "node/123", wenn aus OpenStreetMap übernommen
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Gegessene Brote. Ohne bakery_id = "unterwegs" (freier Ort in place).
create table if not exists public.breads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  bakery_id   uuid references public.bakeries on delete set null,
  bakery_name text,                                  -- Kopie des Namens, falls die Bäckerei gelöscht wird
  place       text,
  price       numeric(6,2) check (price >= 0),
  eaten_on    date not null default current_date,
  plain       smallint check (plain between 1 and 10),     -- Note pur, intern immer 1–10
  toasted     smallint check (toasted between 1 and 10),   -- Note getoastet, intern immer 1–10
  note        text,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists breads_bakery_idx on public.breads (bakery_id);

-- Zugriff: nur angemeldete Personen. Neue Registrierungen im Dashboard abschalten,
-- dann sind das nur die Konten, die ihr selbst anlegt.
alter table public.profiles enable row level security;
alter table public.bakeries enable row level security;
alter table public.breads   enable row level security;

drop policy if exists "profiles lesen"   on public.profiles;
drop policy if exists "profile selbst"   on public.profiles;
drop policy if exists "bakeries alles"   on public.bakeries;
drop policy if exists "breads alles"     on public.breads;

create policy "profiles lesen" on public.profiles for select to authenticated using (true);
create policy "profile selbst" on public.profiles for all    to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "bakeries alles" on public.bakeries for all    to authenticated using (true) with check (true);
create policy "breads alles"   on public.breads   for all    to authenticated using (true) with check (true);

-- Live-Aktualisierung: Einträge der anderen Person erscheinen sofort
do $$
begin
  begin alter publication supabase_realtime add table public.bakeries; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.breads;   exception when duplicate_object then null; end;
end $$;
