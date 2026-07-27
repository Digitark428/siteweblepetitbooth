-- ============================================================
-- LE PETIT BOOTH — Ajout de la galerie photo
-- À coller dans Supabase → SQL Editor → Run (une seule fois)
-- (complément du schéma principal déjà exécuté)
-- ============================================================

create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  url        text not null,
  legende    text,
  position   int  not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists photos_position_idx on public.photos (position);

alter table public.photos enable row level security;

drop policy if exists pub_read_photos on public.photos;
create policy pub_read_photos on public.photos
  for select to anon using (visible);

drop policy if exists admin_all_photos on public.photos;
create policy admin_all_photos on public.photos
  for all to authenticated using (true) with check (true);
