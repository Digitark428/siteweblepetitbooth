-- ============================================================
-- LE PETIT BOOTH — Schéma complet du CMS
-- À coller dans Supabase → SQL Editor → Run (une seule fois)
--
-- Principe de sécurité (IMPORTANT) :
--   • La clé "anon" est publique → visible dans le code du site.
--   • Ce sont donc les règles RLS ci-dessous qui protègent vos données,
--     PAS un mot de passe caché dans le JavaScript.
--   • L'administration s'authentifie via Supabase Auth (un compte admin).
--     Seul un utilisateur connecté peut écrire/lire les données sensibles.
-- ============================================================

-- Helper : "l'utilisateur courant est-il connecté (admin) ?"
create or replace function public.is_admin() returns boolean
language sql stable as $$ select auth.role() = 'authenticated' $$;

-- ============================================================
-- 1. CONTENU ÉDITORIAL — textes, thème, réglages
--    Modèle brouillon / publié + historique de versions.
--    Une seule ligne (id = 1). Le site lit "published".
-- ============================================================
create table if not exists public.site_content (
  id         int primary key default 1,
  draft      jsonb not null default '{}'::jsonb,   -- travail en cours
  published  jsonb not null default '{}'::jsonb,   -- version en ligne
  updated_at timestamptz not null default now(),
  constraint singleton check (id = 1)
);
insert into public.site_content (id) values (1) on conflict do nothing;

-- Historique : chaque publication archive la version précédente.
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
  media_url   text,            -- vidéo (mp4/webm)
  poster_url  text,            -- vignette
  position    int  not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 3. AVIS CLIENTS (classiques + vocaux)
-- ============================================================
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'text' check (kind in ('text','audio')),
  prenom     text,
  nom        text,
  lieu       text,
  photo_url  text,
  texte      text,             -- avis classique
  note       int  check (note between 1 and 5),
  audio_url  text,             -- avis vocal
  position   int  not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. CALENDRIER — prestations confirmées + demandes de devis
--    Affiché publiquement pour montrer un planning demandé.
-- ============================================================
create table if not exists public.calendar_events (
  id             uuid primary key default gen_random_uuid(),
  date_evenement date not null,
  heure          time,
  ville          text,
  type_evenement text,
  statut         text not null default 'confirmee'
                 check (statut in ('confirmee','devis')),  -- devis = "en attente de confirmation"
  created_at     timestamptz not null default now()
);
create index if not exists calendar_date_idx on public.calendar_events (date_evenement);

-- ============================================================
-- 5. DEMANDES DE RÉSERVATION (arrivent du formulaire public)
--    Lecture réservée à l'admin.
-- ============================================================
create table if not exists public.reservations (
  id             uuid primary key default gen_random_uuid(),
  nom            text not null,
  prenom         text not null,
  telephone      text not null,
  email          text not null,
  date_evenement date  not null,
  lieu           text  not null,
  type_evenement text  not null,
  formule        text  not null,
  nb_invites     int,
  message        text,
  statut         text  not null default 'nouvelle'
                 check (statut in ('nouvelle','traitee','archivee')),
  created_at     timestamptz not null default now()
);
create index if not exists reservations_statut_idx on public.reservations (statut);
create index if not exists reservations_created_idx on public.reservations (created_at desc);

-- ============================================================
-- 6. BIBLIOTHÈQUE DE MÉDIAS (métadonnées ; fichiers dans Storage)
-- ============================================================
create table if not exists public.media_assets (
  id         uuid primary key default gen_random_uuid(),
  url        text not null,
  path       text not null,     -- chemin dans le bucket
  name       text not null,
  kind       text not null check (kind in ('image','video','audio')),
  mime       text,
  size_bytes bigint,
  width      int,
  height     int,
  duration   numeric,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7. STATISTIQUES — un événement par action mesurée
-- ============================================================
create table if not exists public.analytics_events (
  id         bigint generated always as identity primary key,
  type       text not null,     -- visit | reserve_click | video_play | audio_play | pageview
  path       text,
  device     text,              -- mobile | tablet | desktop
  ref        text,
  created_at timestamptz not null default now()
);
create index if not exists analytics_type_idx on public.analytics_events (type, created_at desc);

-- Agrégats prêts pour le tableau de bord
create or replace view public.stats_overview as
  select
    count(*) filter (where type='visit' and created_at::date = current_date)                    as visiteurs_jour,
    count(*) filter (where type='visit' and date_trunc('month',created_at)=date_trunc('month',now())) as visiteurs_mois,
    count(*) filter (where type='visit')                                                        as visiteurs_total,
    count(*) filter (where type='reserve_click')                                                as clics_reserver,
    count(*) filter (where type='video_play')                                                   as lectures_videos,
    count(*) filter (where type='audio_play')                                                   as ecoutes_audio
  from public.analytics_events;

-- ============================================================
-- 8. VUE PUBLIQUE DES DATES BLOQUÉES (sans donnée personnelle)
--    Alimente le calendrier du site : confirmées + devis à venir.
-- ============================================================
create or replace view public.dates_reservees as
  select date_evenement, statut
  from public.calendar_events
  where date_evenement >= current_date;

-- ============================================================
-- RLS — Row Level Security
-- ============================================================
alter table public.site_content     enable row level security;
alter table public.content_history  enable row level security;
alter table public.gallery_items    enable row level security;
alter table public.reviews          enable row level security;
alter table public.calendar_events  enable row level security;
alter table public.reservations     enable row level security;
alter table public.media_assets     enable row level security;
alter table public.analytics_events enable row level security;

-- --- Lecture PUBLIQUE (anon) : uniquement ce qui doit être visible ---
create policy pub_read_gallery  on public.gallery_items   for select to anon using (visible);
create policy pub_read_reviews  on public.reviews         for select to anon using (visible);
create policy pub_read_calendar on public.calendar_events for select to anon using (true);

-- Le site ne lit QUE la partie "published" du contenu → via cette fonction,
-- jamais la table directement (le brouillon reste privé).
create or replace function public.get_published_content() returns jsonb
language sql security definer stable as $$ select published from public.site_content where id = 1 $$;
grant execute on function public.get_published_content() to anon;
grant select on public.dates_reservees to anon;
grant select on public.stats_overview to authenticated;

-- --- Écriture PUBLIQUE limitée : demandes + mesure d'audience ---
create policy pub_insert_reservation on public.reservations
  for insert to anon with check (true);
create policy pub_insert_analytics on public.analytics_events
  for insert to anon with check (true);

-- --- ADMIN (authentifié) : accès total sur tout ---
do $$
declare t text;
begin
  foreach t in array array[
    'site_content','content_history','gallery_items','reviews',
    'calendar_events','reservations','media_assets','analytics_events'
  ] loop
    execute format(
      'create policy admin_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============================================================
-- STORAGE — bucket unique "medias" (lecture publique, écriture admin)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('medias','medias', true)
on conflict (id) do nothing;

create policy medias_public_read on storage.objects
  for select to anon using (bucket_id = 'medias');
create policy medias_admin_write on storage.objects
  for all to authenticated using (bucket_id = 'medias') with check (bucket_id = 'medias');

-- ============================================================
-- APRÈS EXÉCUTION :
--   1. Authentication → Users → "Add user" : créez VOTRE compte admin
--      (e-mail + mot de passe lepetitboothstudio). C'est ce compte qui
--      déverrouille l'administration. Changez le mot de passe quand vous voulez.
--   2. Renseignez CONFIG.supabaseUrl / supabaseAnonKey dans le site.
-- ============================================================

-- ============================================================
-- GALERIE PHOTO (ajout)
-- ============================================================
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  url text not null, legende text,
  position int not null default 0, visible boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.photos enable row level security;
drop policy if exists pub_read_photos on public.photos;
create policy pub_read_photos on public.photos for select to anon using (visible);
drop policy if exists admin_all_photos on public.photos;
create policy admin_all_photos on public.photos for all to authenticated using (true) with check (true);
