/**
 * Vérification d'un paiement au retour de Stripe.
 *
 * Quand le client revient sur son espace après avoir payé, le navigateur
 * appelle cette fonction avec l'identifiant de la session Stripe. On relit
 * la session DIRECTEMENT chez Stripe (côté serveur, clé secrète) : si elle
 * est payée, on enregistre le paiement en base — exactement comme le
 * webhook. L'enregistrement est idempotent (anti-doublon sur l'identifiant
 * de session), donc webhook + vérification peuvent tourner tous les deux
 * sans jamais compter un paiement deux fois.
 *
 * Résultat : la fiche client se met à jour même si le webhook n'est pas
 * (encore) configuré chez Stripe.
 *
 * Variables d'environnement (Vercel) :
 *   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: "Stripe n'est pas configuré sur le serveur." });

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { session, token } = body;
    if (!session) return res.status(400).json({ error: 'Session manquante.' });

    // On ne fait JAMAIS confiance au navigateur : on relit la session chez
    // Stripe. Une session inventée n'existe pas et serait rejetée ici.
    const s = await stripe.checkout.sessions.retrieve(String(session));
    if (!s) return res.status(404).json({ error: 'Session introuvable.' });

    const m = s.metadata || {};
    // La session doit appartenir à la fiche depuis laquelle on appelle.
    if (token && m.client_token && m.client_token !== token) {
      return res.status(403).json({ error: 'Session étrangère à ce dossier.' });
    }

    if (s.payment_status !== 'paid') {
      return res.status(200).json({ paye: false, statut: s.payment_status });
    }

    const r = await enregistrer({
      client_id: m.client_id || null,
      client_token: m.client_token || token || null,
      type: m.type || 'total',
      montant: (s.amount_total || 0) / 100,
      session: s.id,
      payment: s.payment_intent || null,
    });

    return res.status(200).json({ paye: true, deja_traite: !!(r && r.deja_traite) });
  } catch (err) {
    console.error('Stripe verify:', err);
    return res.status(500).json({ error: err.message || 'Vérification impossible.' });
  }
};

/* ---------- Écriture en base (même fonction que le webhook) ---------- */
async function enregistrer(p) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase non configuré.');

  const r = await fetch(url + '/rest/v1/rpc/stripe_paiement_confirme', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_client_id: p.client_id,
      p_client_token: p.client_token,
      p_type: p.type,
      p_montant: p.montant,
      p_statut: 'paye',
      p_session: p.session,
      p_payment: p.payment,
    }),
  });
  if (!r.ok) throw new Error('Supabase a refusé : ' + (await r.text()));
  return r.json().catch(() => null);
}
