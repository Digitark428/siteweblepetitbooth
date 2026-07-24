-- ============================================================
-- LE PETIT BOOTH — Base de réservations
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

create table if not exists public.reservations (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null,
  prenom          text not null,
  telephone       text not null,
  email           text not null,
  date_evenement  date not null,
  lieu            text not null,
  type_evenement  text not null,
  formule         text not null,
  nb_invites      integer,
  message         text,
  statut          text not null default 'nouvelle',   -- nouvelle | confirmee | annulee
  created_at      timestamptz not null default now()
);

create index if not exists reservations_date_idx   on public.reservations (date_evenement);
create index if not exists reservations_statut_idx on public.reservations (statut);

-- ------------------------------------------------------------
-- Sécurité (RLS) : le site public peut créer une demande,
-- mais ne peut jamais lire les coordonnées de vos clients.
-- ------------------------------------------------------------
alter table public.reservations enable row level security;

drop policy if exists "insertion publique" on public.reservations;
create policy "insertion publique"
  on public.reservations for insert
  to anon
  with check (true);

-- ------------------------------------------------------------
-- Vue publique : uniquement les dates confirmées, sans donnée
-- personnelle. C'est elle qui alimente le calendrier du site.
-- ------------------------------------------------------------
create or replace view public.dates_reservees
with (security_invoker = off) as
  select date_evenement
  from public.reservations
  where statut = 'confirmee'
    and date_evenement >= current_date;

grant select on public.dates_reservees to anon;

-- ============================================================
-- Le site écrit dans « reservations » et lit « dates_reservees ».
-- Les deux noms sont déjà réglés dans CONFIG (index.html).
-- Passez une demande au statut « confirmee » depuis Supabase
-- pour que sa date apparaisse comme bloquée sur le calendrier.
-- ============================================================
