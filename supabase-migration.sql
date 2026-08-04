-- =====================================================================
--  LE PETIT BOOTH — MIGRATION (à exécuter dans Supabase → SQL Editor)
--
--  ⚠️ NON DESTRUCTIVE : ce script n'efface AUCUNE donnée.
--  Il n'utilise que des "create ... if not exists" et des
--  "create or replace". Aucun drop table, aucun delete, aucun truncate.
--  Vos clients, réservations, avis et médias existants sont préservés.
--
--  Ré-exécutable sans risque autant de fois que nécessaire.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) DÉPÔT D'AVIS PAR LIEN PUBLIC (écrits et vocaux)
--    Le client ouvre un lien, remplit le formulaire : l'avis est publié
--    automatiquement. Aucune intervention manuelle.
-- ---------------------------------------------------------------------

-- Colonnes ajoutées à la table des avis existante (sans toucher aux données)
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
