-- =====================================================================
--  LE PETIT BOOTH — MODULE FACTURATION
--  À exécuter dans Supabase → SQL Editor → Run.
--
--  ⚠️ NON DESTRUCTIF : uniquement des ajouts.
--  Aucun drop table, aucun delete, aucun truncate.
--  Ré-exécutable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) NUMÉROTATION AUTOMATIQUE DES DOCUMENTS
--    Un compteur par préfixe : D (devis), FA (acompte), FS (solde), F (facture).
--    L'attribution est atomique : deux documents ne peuvent jamais recevoir
--    le même numéro, même en cas de clics simultanés.
-- ---------------------------------------------------------------------
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
