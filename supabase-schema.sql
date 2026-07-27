-- ============================================================
-- LE PETIT BOOTH — SCHÉMA COMPLET (base générale + galerie photo)
-- À coller dans Supabase → SQL Editor → Run.
-- Ce fichier est RÉ-EXÉCUTABLE : vous pouvez le relancer sans erreur,
-- que la base soit vierge ou déjà en place. Il contient TOUT.
--
-- Sécurité : la clé "anon" est publique (visible dans le code du site).
-- Ce sont les règles RLS ci-dessous qui protègent vos données.
-- L'administration s'authentifie via Supabase Auth (un compte admin).
-- ============================================================

-- Helper : "l'utilisateur courant est-il connecté (admin) ?"
create or replace function public.is_admin() returns boolean
language sql stable as $$ select auth.role() = 'authenticated' $$;

-- ============================================================
-- 1. CONTENU ÉDITORIAL — textes, thème, réglages (brouillon/publié)
-- ============================================================
create table if not exists public.site_content (
  id         int primary key default 1,
  draft      jsonb not null default '{}'::jsonb,
  published  jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint singleton check (id = 1)
);
insert into public.site_content (id) values (1) on conflict do nothing;

create table if not exists public.content_history (
  id           bigint generated always as identity primary key,
  snapshot     jsonb not null,
  label        text,
  published_at timestamptz not null default now()
);

-- ============================================================
-- 2. GALERIE VIDÉO
-- ============================================================
create table if not exists public.gallery_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  media_url   text,
  poster_url  text,
  position    int  not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 3. GALERIE PHOTO
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

-- ============================================================
-- 4. AVIS CLIENTS (classiques + vocaux)
-- ============================================================
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'text' check (kind in ('text','audio')),
  prenom     text, nom text, lieu text,
  photo_url  text, texte text,
  note       int  check (note between 1 and 5),
  audio_url  text,
  position   int  not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. CALENDRIER — prestations confirmées + devis
-- ============================================================
create table if not exists public.calendar_events (
  id             uuid primary key default gen_random_uuid(),
  date_evenement date not null,
  heure          time,
  ville          text,
  type_evenement text,
  statut         text not null default 'confirmee' check (statut in ('confirmee','devis')),
  created_at     timestamptz not null default now()
);
create index if not exists calendar_date_idx on public.calendar_events (date_evenement);

-- ============================================================
-- 6. DEMANDES DE RÉSERVATION (formulaire public ; lecture admin only)
-- ============================================================
create table if not exists public.reservations (
  id             uuid primary key default gen_random_uuid(),
  nom text not null, prenom text not null,
  telephone text not null, email text not null,
  date_evenement date not null, lieu text not null,
  type_evenement text not null, formule text not null,
  nb_invites int, message text,
  statut text not null default 'nouvelle' check (statut in ('nouvelle','traitee','archivee')),
  created_at timestamptz not null default now()
);
create index if not exists reservations_statut_idx on public.reservations (statut);
create index if not exists reservations_created_idx on public.reservations (created_at desc);

-- ============================================================
-- 7. MÉDIATHÈQUE (métadonnées ; fichiers dans Storage)
-- ============================================================
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null, path text not null, name text not null,
  kind text not null check (kind in ('image','video','audio')),
  mime text, size_bytes bigint, width int, height int, duration numeric,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 8. STATISTIQUES
-- ============================================================
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  type text not null, path text, device text, ref text,
  created_at timestamptz not null default now()
);
create index if not exists analytics_type_idx on public.analytics_events (type, created_at desc);

create or replace view public.stats_overview as
  select
    count(*) filter (where type='visit' and created_at::date = current_date) as visiteurs_jour,
    count(*) filter (where type='visit' and date_trunc('month',created_at)=date_trunc('month',now())) as visiteurs_mois,
    count(*) filter (where type='visit') as visiteurs_total,
    count(*) filter (where type='reserve_click') as clics_reserver,
    count(*) filter (where type='video_play') as lectures_videos,
    count(*) filter (where type='audio_play') as ecoutes_audio
  from public.analytics_events;

create or replace view public.dates_reservees as
  select date_evenement, statut
  from public.calendar_events
  where date_evenement >= current_date;

-- ============================================================
-- FONCTION : contenu publié (lisible par le site public)
-- ============================================================
create or replace function public.get_published_content() returns jsonb
language sql security definer stable as $$ select published from public.site_content where id = 1 $$;

-- ============================================================
-- RLS — activation
-- ============================================================
alter table public.site_content     enable row level security;
alter table public.content_history  enable row level security;
alter table public.gallery_items    enable row level security;
alter table public.photos           enable row level security;
alter table public.reviews          enable row level security;
alter table public.calendar_events  enable row level security;
alter table public.reservations     enable row level security;
alter table public.media_assets     enable row level security;
alter table public.analytics_events enable row level security;

-- Lecture PUBLIQUE (anon) — uniquement le visible
drop policy if exists pub_read_gallery  on public.gallery_items;
create policy pub_read_gallery  on public.gallery_items   for select to anon using (visible);
drop policy if exists pub_read_photos   on public.photos;
create policy pub_read_photos   on public.photos          for select to anon using (visible);
drop policy if exists pub_read_reviews  on public.reviews;
create policy pub_read_reviews  on public.reviews         for select to anon using (visible);
drop policy if exists pub_read_calendar on public.calendar_events;
create policy pub_read_calendar on public.calendar_events for select to anon using (true);

grant execute on function public.get_published_content() to anon;
grant select on public.dates_reservees to anon;
grant select on public.stats_overview to authenticated;

-- Écriture PUBLIQUE limitée : demandes + mesure d'audience
drop policy if exists pub_insert_reservation on public.reservations;
create policy pub_insert_reservation on public.reservations for insert to anon with check (true);
drop policy if exists pub_insert_analytics on public.analytics_events;
create policy pub_insert_analytics on public.analytics_events for insert to anon with check (true);

-- ADMIN (authentifié) : accès total sur chaque table
do $$
declare t text;
begin
  foreach t in array array[
    'site_content','content_history','gallery_items','photos','reviews',
    'calendar_events','reservations','media_assets','analytics_events'
  ] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============================================================
-- STORAGE — bucket "medias" (lecture publique, écriture admin)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('medias','medias', true)
on conflict (id) do nothing;

drop policy if exists medias_public_read on storage.objects;
create policy medias_public_read on storage.objects
  for select to anon using (bucket_id = 'medias');
drop policy if exists medias_admin_write on storage.objects;
create policy medias_admin_write on storage.objects
  for all to authenticated using (bucket_id = 'medias') with check (bucket_id = 'medias');

-- ============================================================
-- APRÈS EXÉCUTION :
--   1. Authentication → Users → Add user : créez votre compte admin.
--   2. Renseignez URL + clé anon dans le site (CONFIG) et dans Vercel.
-- Tout est inclus ici — inutile d'exécuter un autre fichier SQL.
-- ============================================================
