-- =====================================================================
--  LE PETIT BOOTH — BASE DE DONNÉES COMPLÈTE (fichier unique)
--
--  Contient TOUT le projet :
--    · Site public (contenu, galeries, avis, calendrier, réservations)
--    · CRM (clients, prestataires, liens privés)
--    · Avis par lien, musiques client, statistiques
--    · Facturation (devis, factures, numérotation)
--    · Paiements Stripe (production)
--
--  MODE D'EMPLOI
--    Supabase → SQL Editor → nouvelle requête → coller ce fichier → Run.
--    C'est le SEUL fichier à exécuter. Aucun autre n'est nécessaire.
--
--  ⚠️ NON DESTRUCTIF
--    Uniquement des ajouts : create ... if not exists, add column if not
--    exists, create or replace. AUCUN drop table, delete ni truncate.
--    Vos clients, réservations, avis, documents et médias sont préservés.
--    Ré-exécutable autant de fois que nécessaire, sans risque.
-- =====================================================================



-- ==================================================================
-- PARTIE 1 — FONDATIONS (site public + CRM)
-- ==================================================================

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


-- ==================================================================
-- PARTIE 2 — AVIS, CALENDRIER, MUSIQUES, STATISTIQUES
-- ==================================================================

alter table public.reviews add column if not exists source text default 'admin';
alter table public.reviews add column if not exists submitted_at timestamptz;

-- Table des liens d'invitation (un lien = un token)
create table if not exists public.review_invites (
  token      text primary key,
  kind       text not null default 'text' check (kind in ('text','audio')),
  label      text,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
alter table public.review_invites enable row level security;
drop policy if exists admin_all_invites on public.review_invites;
create policy admin_all_invites on public.review_invites
  for all to authenticated using (true) with check (true);

-- Enregistrement d'un avis depuis le formulaire public.
-- Publié directement (visible = true). Le token est facultatif :
-- s'il est fourni et connu, il est marqué comme utilisé.
create or replace function public.submit_review(
  p_token text, p_kind text,
  p_prenom text, p_nom text, p_lieu text,
  p_texte text, p_note int,
  p_photo_url text, p_audio_url text
) returns void language plpgsql security definer set search_path = public as $$
declare v_pos int;
begin
  if coalesce(trim(p_prenom),'') = '' then raise exception 'prenom requis'; end if;
  if p_kind not in ('text','audio') then raise exception 'kind invalide'; end if;
  if p_kind = 'text'  and coalesce(trim(p_texte),'') = ''     then raise exception 'texte requis'; end if;
  if p_kind = 'audio' and coalesce(trim(p_audio_url),'') = '' then raise exception 'audio requis'; end if;

  select coalesce(max(position), 0) + 1 into v_pos from public.reviews;

  insert into public.reviews (kind, prenom, nom, lieu, texte, note, photo_url, audio_url,
                              position, visible, source, submitted_at)
  values (p_kind, trim(p_prenom), nullif(trim(coalesce(p_nom,'')),''), nullif(trim(coalesce(p_lieu,'')),''),
          nullif(trim(coalesce(p_texte,'')),''), greatest(1, least(5, coalesce(p_note,5))),
          nullif(trim(coalesce(p_photo_url,'')),''), nullif(trim(coalesce(p_audio_url,'')),''),
          v_pos, true, 'client', now());

  if coalesce(p_token,'') <> '' then
    update public.review_invites set used_at = now() where token = p_token;
  end if;
end $$;

grant execute on function public.submit_review(text,text,text,text,text,text,int,text,text) to anon, authenticated;

-- Le formulaire public doit pouvoir déposer sa photo / son audio.
drop policy if exists medias_public_upload_avis on storage.objects;
create policy medias_public_upload_avis on storage.objects
  for insert to anon
  with check (bucket_id = 'medias' and (storage.foldername(name))[1] = 'avis');

-- ---------------------------------------------------------------------
-- 2) SYNCHRONISATION CRM → CALENDRIER PUBLIC
--    Le CRM devient la source principale : une date d'événement saisie
--    dans une fiche client bloque automatiquement le calendrier public.
--    Les dates bloquées à la main (calendar_events) restent valables :
--    la vue publique fusionne les deux sources.
-- ---------------------------------------------------------------------

-- Conversion de date tolérante : renvoie NULL si la valeur n'est pas une
-- date valide, au lieu de faire échouer toute la vue.
create or replace function public._safe_date(t text)
returns date language plpgsql immutable as $$
begin
  return t::date;
exception when others then
  return null;
end $$;

-- Statut déduit du pipeline CRM :
--   acompte / solde / confirmé / terminé  → date confirmée (réservée)
--   devis envoyé / en attente             → devis (en attente)
--   demande reçue                         → pas de blocage
create or replace function public._crm_statut(p_status text)
returns text language sql immutable as $$
  select case
    when p_status in ('acompte','acompte_recu','date_bloquee_acompte',
                      'solde','solde_recu','date_bloquee_solde',
                      'confirme','confirmee','termine') then 'confirmee'
    when p_status in ('devis','devis_envoye','attente','en_attente') then 'devis'
    else null end
$$;

-- Vue publique fusionnée (remplace l'ancienne, même nom, mêmes colonnes :
-- aucune modification à faire côté site).
-- On supprime la vue avant de la recréer : PostgreSQL refuse de
-- remplacer une vue dont les colonnes ont changé. Une vue ne contient
-- aucune donnée, cette suppression est donc sans effet sur vos tables.
drop view if exists public.dates_reservees;
create view public.dates_reservees as
  select date_evenement, statut from (
    -- a) dates bloquées manuellement dans l'administration
    select ce.date_evenement, ce.statut
    from public.calendar_events ce
    where ce.date_evenement >= current_date
    union all
    -- b) dates issues des fiches clients du CRM
    select d.dt as date_evenement, d.st as statut
    from (
      select public._safe_date(c.payload->>'datePrestation') as dt,
             public._crm_statut(c.payload->>'status')        as st
      from public.clients c
    ) d
    where d.dt is not null and d.st is not null and d.dt >= current_date
  ) t
  where statut is not null;

grant select on public.dates_reservees to anon, authenticated;

-- Vue de contrôle : d'où vient chaque date bloquée (utile pour l'admin)
-- On supprime la vue avant de la recréer : PostgreSQL refuse de
-- remplacer une vue dont les colonnes ont changé. Une vue ne contient
-- aucune donnée, cette suppression est donc sans effet sur vos tables.
drop view if exists public.dates_bloquees_detail;
create view public.dates_bloquees_detail as
  select 'Administration'::text as origine, ce.date_evenement, ce.statut, ce.ville as info
  from public.calendar_events ce where ce.date_evenement >= current_date
  union all
  select 'CRM'::text, d.dt, d.st, d.qui
  from (
    select public._safe_date(c.payload->>'datePrestation') as dt,
           public._crm_statut(c.payload->>'status')        as st,
           concat_ws(' ', c.payload->>'prenom', c.payload->>'nom') as qui
    from public.clients c
  ) d
  where d.dt is not null and d.st is not null and d.dt >= current_date;

grant select on public.dates_bloquees_detail to authenticated;

-- ---------------------------------------------------------------------
-- 3) MUSIQUES DU CLIENT (jusqu'à 4 titres) depuis son espace client
--    Les musiques sont stockées dans la fiche client (payload.musiques)
--    et remontent donc automatiquement dans le dossier CRM.
-- ---------------------------------------------------------------------
create or replace function public.client_save_musiques(p_token text, p_musiques jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_token,'') = '' then raise exception 'token requis'; end if;
  if jsonb_typeof(p_musiques) <> 'array' then raise exception 'format invalide'; end if;
  if jsonb_array_length(p_musiques) > 4 then raise exception 'maximum 4 musiques'; end if;

  update public.clients
     set payload = jsonb_set(payload, '{musiques}', p_musiques, true),
         updated_at = now()
   where token = p_token;

  if not found then raise exception 'lien inconnu'; end if;
end $$;

grant execute on function public.client_save_musiques(text,jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) STATISTIQUES — vue enrichie (visiteurs, conversion, demandes)
-- ---------------------------------------------------------------------
-- On supprime la vue avant de la recréer : PostgreSQL refuse de
-- remplacer une vue dont les colonnes ont changé. Une vue ne contient
-- aucune donnée, cette suppression est donc sans effet sur vos tables.
drop view if exists public.stats_overview;
create view public.stats_overview as
  select
    (select count(*) from public.analytics_events where type='visit' and created_at::date = current_date)                                as visiteurs_jour,
    (select count(*) from public.analytics_events where type='visit' and date_trunc('month',created_at)=date_trunc('month',now()))       as visiteurs_mois,
    (select count(*) from public.analytics_events where type='visit')                                                                    as visiteurs_total,
    (select count(*) from public.analytics_events where type='reserve_click')                                                            as clics_reserver,
    (select count(*) from public.analytics_events where type='video_play')                                                               as lectures_videos,
    (select count(*) from public.analytics_events where type='audio_play')                                                               as ecoutes_audio,
    (select count(*) from public.reservations)                                                                                           as demandes_total,
    (select count(*) from public.reservations where statut='nouvelle')                                                                   as demandes_nouvelles,
    (select count(*) from public.reservations where date_trunc('month',created_at)=date_trunc('month',now()))                             as demandes_mois,
    case when (select count(*) from public.analytics_events where type='visit') > 0
         then round(100.0 * (select count(*) from public.reservations)
                          / (select count(*) from public.analytics_events where type='visit'), 1)
         else 0 end                                                                                                                      as taux_conversion;

grant select on public.stats_overview to authenticated;

-- =====================================================================
--  Terminé. Aucune donnée existante n'a été modifiée ni supprimée.
-- =====================================================================


-- ==================================================================
-- PARTIE 3 — FACTURATION (devis, factures, numérotation)
-- ==================================================================

create table if not exists public.doc_counters (
  prefix     text primary key,
  last_num   int  not null default 0,
  updated_at timestamptz not null default now()
);

-- Valeurs de départ (modifiables ensuite dans les paramètres).
insert into public.doc_counters (prefix, last_num) values
  ('D', 19), ('FA', 12), ('FS', 6), ('F', 16)
on conflict (prefix) do nothing;

alter table public.doc_counters enable row level security;
drop policy if exists admin_all_counters on public.doc_counters;
create policy admin_all_counters on public.doc_counters
  for all to authenticated using (true) with check (true);

-- Renvoie le prochain numéro formaté, ex. « D/20 », et incrémente le compteur.
create or replace function public.next_doc_number(p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare v_num int;
begin
  if p_prefix not in ('D','FA','FS','F') then
    raise exception 'préfixe inconnu : %', p_prefix;
  end if;
  insert into public.doc_counters (prefix, last_num) values (p_prefix, 0)
    on conflict (prefix) do nothing;
  update public.doc_counters
     set last_num = last_num + 1, updated_at = now()
   where prefix = p_prefix
  returning last_num into v_num;
  return p_prefix || '/' || v_num;
end $$;

grant execute on function public.next_doc_number(text) to anon, authenticated;

-- Permet de régler le point de départ d'un compteur depuis les paramètres.
create or replace function public.set_doc_counter(p_prefix text, p_value int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_prefix not in ('D','FA','FS','F') then raise exception 'préfixe inconnu'; end if;
  if p_value < 0 then raise exception 'valeur invalide'; end if;
  insert into public.doc_counters (prefix, last_num) values (p_prefix, p_value)
    on conflict (prefix) do update set last_num = excluded.last_num, updated_at = now();
end $$;

grant execute on function public.set_doc_counter(text,int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) PARAMÈTRES DE FACTURATION
--    Coordonnées, logo, IBAN/BIC, SIREN, mentions, textes, délais,
--    taux d'acompte… Tout est modifiable depuis l'administration.
-- ---------------------------------------------------------------------
create table if not exists public.facturation_settings (
  id         int primary key default 1,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint facturation_singleton check (id = 1)
);
insert into public.facturation_settings (id, payload) values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.facturation_settings enable row level security;
drop policy if exists admin_all_facturation on public.facturation_settings;
create policy admin_all_facturation on public.facturation_settings
  for all to authenticated using (true) with check (true);

-- Lecture (admin ou espace client, pour l'aperçu des documents)
create or replace function public.facturation_get()
returns jsonb language sql security definer stable set search_path = public
as $$ select payload from public.facturation_settings where id = 1 $$;

create or replace function public.facturation_save(p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'authenticated' then raise exception 'unauthorized'; end if;
  update public.facturation_settings
     set payload = p_payload, updated_at = now()
   where id = 1;
end $$;

grant execute on function public.facturation_get()      to anon, authenticated;
grant execute on function public.facturation_save(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3) PAIEMENTS — structure prête pour Stripe (aucune clé requise pour l'instant)
--    Chaque ligne = une tentative ou un encaissement.
--    Les colonnes stripe_* resteront vides tant que Stripe n'est pas branché.
-- ---------------------------------------------------------------------
create table if not exists public.paiements (
  id                 uuid primary key default gen_random_uuid(),
  client_id          text not null,
  client_token       text,
  type               text not null check (type in ('acompte','solde','total','echelonne')),
  montant            numeric(10,2) not null default 0,
  statut             text not null default 'en_attente'
                     check (statut in ('en_attente','paye','echoue','rembourse')),
  moyen              text,               -- 'stripe', 'virement', 'especes', 'cheque'…
  reference          text,               -- référence libre (n° de virement…)
  stripe_session_id  text,
  stripe_payment_id  text,
  paye_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists paiements_client_idx on public.paiements (client_id, created_at desc);

alter table public.paiements enable row level security;
drop policy if exists admin_all_paiements on public.paiements;
create policy admin_all_paiements on public.paiements
  for all to authenticated using (true) with check (true);

-- Historique des paiements visible depuis l'espace client (lien privé)
create or replace function public.paiements_by_token(p_token text)
returns jsonb language sql security definer stable set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'type', p.type, 'montant', p.montant, 'statut', p.statut,
           'moyen', p.moyen, 'paye_at', p.paye_at, 'created_at', p.created_at
         ) order by p.created_at desc), '[]'::jsonb)
  from public.paiements p
  join public.clients c on c.id = p.client_id
  where c.token = p_token
$$;

grant execute on function public.paiements_by_token(text) to anon, authenticated;

-- Enregistrement d'un paiement (utilisé par l'administration aujourd'hui,
-- et par le retour Stripe demain — la signature ne changera pas).
create or replace function public.paiement_enregistrer(
  p_client_id text, p_type text, p_montant numeric,
  p_statut text default 'paye', p_moyen text default null,
  p_reference text default null,
  p_stripe_session text default null, p_stripe_payment text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_token text;
begin
  if auth.role() <> 'authenticated' then raise exception 'unauthorized'; end if;
  select token into v_token from public.clients where id = p_client_id;
  insert into public.paiements (client_id, client_token, type, montant, statut, moyen,
                                reference, stripe_session_id, stripe_payment_id, paye_at)
  values (p_client_id, v_token, p_type, coalesce(p_montant,0), coalesce(p_statut,'paye'),
          p_moyen, p_reference, p_stripe_session, p_stripe_payment,
          case when coalesce(p_statut,'paye') = 'paye' then now() else null end)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.paiement_enregistrer(text,text,numeric,text,text,text,text,text)
  to authenticated;

-- =====================================================================
--  Terminé. Aucune donnée existante n'a été modifiée ni supprimée.
--
--  Pour brancher Stripe plus tard : renseignez vos clés dans les
--  paramètres de facturation, et un webhook appellera
--  paiement_enregistrer(...) avec les identifiants stripe_*.
--  Aucun autre développement ne sera nécessaire côté base.
-- =====================================================================


-- ==================================================================
-- PARTIE 4 — PAIEMENTS STRIPE (production)
-- ==================================================================

alter table public.paiements add column if not exists vu boolean not null default false;

-- ---------------------------------------------------------------------
-- Confirmation d'un paiement Stripe.
-- Appelée UNIQUEMENT par le webhook (côté serveur, clé service_role).
-- Elle enregistre le paiement, met à jour les statuts de la fiche client
-- et fait avancer le pipeline — tout en une seule opération.
-- ---------------------------------------------------------------------
create or replace function public.stripe_paiement_confirme(
  p_client_id   text,
  p_client_token text,
  p_type        text,
  p_montant     numeric,
  p_statut      text default 'paye',
  p_session     text default null,
  p_payment     text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id       text;
  v_token    text;
  v_payload  jsonb;
  v_factu    jsonb;
  v_paie     jsonb;
  v_statut   text;
begin
  -- Retrouver la fiche (par identifiant ou par lien privé)
  select id, token, payload into v_id, v_token, v_payload
  from public.clients
  where (p_client_id is not null and id = p_client_id)
     or (p_client_token is not null and token = p_client_token)
  limit 1;

  if v_id is null then
    raise exception 'Fiche client introuvable (id=%, token=%)', p_client_id, p_client_token;
  end if;

  -- Anti-doublon : Stripe peut renvoyer deux fois le même événement
  if p_session is not null and exists (
      select 1 from public.paiements where stripe_session_id = p_session
  ) then
    return jsonb_build_object('deja_traite', true);
  end if;

  -- 1) Trace du paiement
  insert into public.paiements (client_id, client_token, type, montant, statut, moyen,
                                stripe_session_id, stripe_payment_id, paye_at, vu)
  values (v_id, v_token, p_type, coalesce(p_montant,0), coalesce(p_statut,'paye'), 'stripe',
          p_session, p_payment,
          case when coalesce(p_statut,'paye') = 'paye' then now() else null end,
          false);

  -- 2) Mise à jour des statuts dans la fiche
  v_factu := coalesce(v_payload->'factu', '{}'::jsonb);
  v_statut := v_payload->>'status';

  if coalesce(p_statut,'paye') = 'rembourse' then
    v_factu := v_factu || jsonb_build_object('paiementStatut','rembourse');
  elsif p_type = 'acompte' then
    v_factu := v_factu || jsonb_build_object(
      'faStatut','payee', 'fsStatut','a_payer',
      'devisStatut','accepte', 'paiementStatut','acompte');
    if v_statut in ('demande','devis','attente') or v_statut is null then v_statut := 'acompte'; end if;
  elsif p_type = 'solde' then
    v_factu := v_factu || jsonb_build_object(
      'fsStatut','payee', 'fStatut','payee', 'paiementStatut','complet');
    v_statut := 'solde';
  else -- total
    v_factu := v_factu || jsonb_build_object(
      'faStatut','payee', 'fsStatut','payee', 'fStatut','payee',
      'devisStatut','accepte', 'paiementStatut','complet');
    v_statut := 'solde';
  end if;

  -- 3) Historique dans la fiche (visible côté client et CRM)
  v_paie := coalesce(v_payload->'paiements', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'type', p_type, 'montant', coalesce(p_montant,0),
      'statut', coalesce(p_statut,'paye'), 'moyen', 'stripe',
      'date', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));

  update public.clients
     set payload = v_payload
                   || jsonb_build_object('factu', v_factu)
                   || jsonb_build_object('paiements', v_paie)
                   || jsonb_build_object('status', v_statut),
         updated_at = now()
   where id = v_id;

  return jsonb_build_object('ok', true, 'client_id', v_id, 'statut', v_statut);
end $$;

-- Cette fonction ne doit JAMAIS être appelable depuis un navigateur.
revoke all on function public.stripe_paiement_confirme(text,text,text,numeric,text,text,text) from public, anon, authenticated;
grant execute on function public.stripe_paiement_confirme(text,text,text,numeric,text,text,text) to service_role;

-- ---------------------------------------------------------------------
-- Paiements récents non encore vus (cloche de notification du CRM)
-- ---------------------------------------------------------------------
drop view if exists public.paiements_recents;
create view public.paiements_recents as
  select p.id, p.client_id, p.type, p.montant, p.statut, p.moyen, p.vu,
         p.paye_at, p.created_at,
         concat_ws(' ', c.payload->>'prenom', c.payload->>'nom') as client,
         c.payload->>'datePrestation' as date_evenement
  from public.paiements p
  left join public.clients c on c.id = p.client_id
  where p.statut in ('paye','rembourse')
  order by p.created_at desc;

grant select on public.paiements_recents to authenticated;

create or replace function public.paiements_marquer_vus()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'authenticated' then raise exception 'unauthorized'; end if;
  update public.paiements set vu = true where vu = false;
end $$;

grant execute on function public.paiements_marquer_vus() to authenticated;

-- =====================================================================
--  Terminé. Aucune donnée existante n'a été modifiée ni supprimée.
-- =====================================================================


-- =====================================================================
--  TERMINÉ.
--
--  Vérification : Table Editor → vous devez voir ces 15 tables :
--    site_content, content_history, gallery_items, photos, reviews,
--    calendar_events, reservations, media_assets, analytics_events,
--    clients, prestataires, review_invites, doc_counters,
--    facturation_settings, paiements.
--
--  Aucune donnée existante n'a été modifiée ni supprimée.
-- =====================================================================
