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

-- On supprime la vue avant de la recréer : PostgreSQL refuse de
-- remplacer une vue dont les colonnes ont changé. Une vue ne contient
-- aucune donnée, cette suppression est donc sans effet sur vos tables.
drop view if exists public.stats_overview;
create view public.stats_overview as
  select
    count(*) filter (where type='visit' and created_at::date = current_date) as visiteurs_jour,
    count(*) filter (where type='visit' and date_trunc('month',created_at)=date_trunc('month',now())) as visiteurs_mois,
    count(*) filter (where type='visit') as visiteurs_total,
    count(*) filter (where type='reserve_click') as clics_reserver,
    count(*) filter (where type='video_play') as lectures_videos,
    count(*) filter (where type='audio_play') as ecoutes_audio
  from public.analytics_events;

-- On supprime la vue avant de la recréer : PostgreSQL refuse de
-- remplacer une vue dont les colonnes ont changé. Une vue ne contient
-- aucune donnée, cette suppression est donc sans effet sur vos tables.
drop view if exists public.dates_reservees;
create view public.dates_reservees as
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

-- ============================================================
-- CRM — CLIENTS & PRESTATAIRES (intégré à l'administration)
-- Sécurité unifiée : les fonctions admin acceptent SOIT votre session
-- admin (Supabase Auth, rôle 'authenticated'), SOIT l'ancien mot de passe
-- CRM en secours. Les tables ne sont jamais lues en direct par le public.
-- ============================================================
create table if not exists public.clients (
  id text primary key, token text unique not null,
  payload jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.prestataires (
  id text primary key, token text unique not null,
  payload jsonb not null, updated_at timestamptz not null default now()
);
alter table public.clients      enable row level security;
alter table public.prestataires enable row level security;

-- Mot de passe CRM de secours (⬇️ modifiable). La session admin suffit désormais.
create or replace function public._admin_pw()
returns text language sql immutable set search_path = public
as $$ select 'KevinObscur974'::text $$;
revoke all on function public._admin_pw() from public;

-- Autorisé si : connecté (session admin) OU ancien mot de passe CRM correct.
create or replace function public._crm_ok(p_pw text)
returns boolean language sql stable set search_path = public
as $$ select auth.role() = 'authenticated' or p_pw is not distinct from public._admin_pw() $$;

create or replace function public.admin_data(p_pw text)
returns jsonb language plpgsql security definer stable set search_path = public as $$
begin
  if not public._crm_ok(p_pw) then raise exception 'unauthorized'; end if;
  return jsonb_build_object(
    'clients',      coalesce((select jsonb_agg(payload order by updated_at) from public.clients), '[]'::jsonb),
    'prestataires', coalesce((select jsonb_agg(payload order by updated_at) from public.prestataires), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_save(p_pw text, p_kind text, p_id text, p_token text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._crm_ok(p_pw) then raise exception 'unauthorized'; end if;
  if p_kind = 'client' then
    insert into public.clients(id, token, payload, updated_at) values (p_id, p_token, p_payload, now())
      on conflict (id) do update set token=excluded.token, payload=excluded.payload, updated_at=now();
  elsif p_kind = 'prestataire' then
    insert into public.prestataires(id, token, payload, updated_at) values (p_id, p_token, p_payload, now())
      on conflict (id) do update set token=excluded.token, payload=excluded.payload, updated_at=now();
  else raise exception 'bad kind'; end if;
end $$;

create or replace function public.admin_delete(p_pw text, p_kind text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._crm_ok(p_pw) then raise exception 'unauthorized'; end if;
  if p_kind = 'client' then delete from public.clients where id = p_id;
  elsif p_kind = 'prestataire' then delete from public.prestataires where id = p_id;
  else raise exception 'bad kind'; end if;
end $$;

-- Liens privés par token (clients / prestataires) — lecture publique contrôlée
create or replace function public.client_by_token(p_token text)
returns jsonb language sql security definer stable set search_path = public
as $$ select payload from public.clients where token = p_token limit 1 $$;

create or replace function public.prestataire_by_token(p_token text)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare pr jsonb; missions jsonb;
begin
  select payload into pr from public.prestataires where token = p_token limit 1;
  if pr is null then return null; end if;
  select coalesce(jsonb_agg(m order by m->>'datePrestation'), '[]'::jsonb) into missions
  from (
    select jsonb_build_object(
      'prenom', c.payload->>'prenom', 'nom', c.payload->>'nom',
      'telephone', c.payload->>'telephone', 'typeEvenement', c.payload->>'typeEvenement',
      'datePrestation', c.payload->>'datePrestation', 'adresse', c.payload->>'adresse',
      'lieu', c.payload->>'lieu', 'notes', c.payload->>'notes', 'status', c.payload->>'status',
      'heureDebut', coalesce(nullif(asg.a->>'heureDebut',''), c.payload->>'heureDebut'),
      'heureFin',   coalesce(nullif(asg.a->>'heureFin',''),   c.payload->>'heureFin'),
      'montant',    coalesce(asg.a->>'montant','0')
    ) as m
    from public.clients c
    left join lateral (
      select el.value as a from jsonb_array_elements(coalesce(c.payload->'assignments','[]'::jsonb)) el
      where el.value->>'nom' = pr->>'nom' limit 1
    ) asg on true
    where (c.payload->>'prestataire' = pr->>'nom') or (asg.a is not null)
  ) sub;
  return jsonb_build_object('prestataire', pr, 'missions', missions);
end $$;

grant execute on function public.admin_data(text)                      to anon, authenticated;
grant execute on function public.admin_save(text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.admin_delete(text,text,text)          to anon, authenticated;
grant execute on function public.client_by_token(text)                 to anon, authenticated;
grant execute on function public.prestataire_by_token(text)            to anon, authenticated;
