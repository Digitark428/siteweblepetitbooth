-- =====================================================================
--  LE PETIT BOOTH — PAIEMENTS STRIPE (production)
--  À exécuter dans Supabase → SQL Editor → Run.
--  NON DESTRUCTIF : uniquement des ajouts. Ré-exécutable.
-- =====================================================================

-- Marqueur « paiement vu » pour la notification dans le CRM
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
