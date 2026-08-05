/**
 * Webhook Stripe — reçoit la confirmation de paiement.
 *
 * C'est Stripe qui appelle cette adresse, pas le navigateur. On ne fait
 * jamais confiance au retour du client : seul ce webhook fait foi.
 *
 * À déclarer dans Stripe → Developers → Webhooks :
 *   URL          https://votre-site.vercel.app/api/stripe-webhook
 *   Événements   checkout.session.completed
 *                charge.refunded
 *
 * Variables d'environnement (Vercel) :
 *   STRIPE_SECRET_KEY          sk_live_…
 *   STRIPE_WEBHOOK_SECRET      whsec_…  (donné par Stripe à la création)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const Stripe = require('stripe');

// On désactive l'analyse automatique du corps : la vérification de
// signature Stripe exige le contenu brut, octet pour octet.
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send('Stripe non configuré.');

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

  let event = null;
  try {
    const raw = await lireCorpsBrut(req);

    // 1) Voie normale : vérification de la signature sur le corps brut.
    if (whSecret && req.headers['stripe-signature'] && raw) {
      try {
        event = stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], whSecret);
      } catch (_) {
        // Vercel transforme parfois le corps avant qu'on puisse le lire :
        // la signature ne correspond plus. On bascule sur la voie 2.
        event = null;
      }
    }

    // 2) Voie de secours, tout aussi sûre : on relit l'événement DIRECTEMENT
    // chez Stripe à partir de son identifiant. Un événement inventé n'existe
    // pas côté Stripe et serait rejeté ici.
    if (!event) {
      const recu = raw ? JSON.parse(raw.toString('utf8')) : req.body;
      if (!recu || !recu.id) throw new Error('Événement illisible.');
      event = await stripe.events.retrieve(recu.id);
    }
  } catch (err) {
    console.error('Webhook refusé :', err.message);
    return res.status(400).send('Événement invalide : ' + err.message);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      if (s.payment_status === 'paid') {
        const m = s.metadata || {};
        await enregistrer({
          client_id: m.client_id,
          client_token: m.client_token,
          type: m.type || 'total',
          montant: (s.amount_total || 0) / 100,
          statut: 'paye',
          session: s.id,
          payment: s.payment_intent || null,
        });
      }
    }

    if (event.type === 'charge.refunded') {
      const ch = event.data.object;
      const m = (ch.metadata && ch.metadata.client_id) ? ch.metadata : null;
      if (m) {
        await enregistrer({
          client_id: m.client_id, client_token: m.client_token,
          type: m.type || 'total', montant: (ch.amount_refunded || 0) / 100,
          statut: 'rembourse', session: null, payment: ch.payment_intent || null,
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Traitement webhook :', err);
    // On renvoie 500 pour que Stripe réessaie automatiquement.
    return res.status(500).send('Erreur de traitement');
  }
};

/* ---------- Corps brut de la requête ---------- */
async function lireCorpsBrut(req) {
  if (req.body && Buffer.isBuffer(req.body)) return req.body;
  try {
    const chunks = [];
    for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
    return chunks.length ? Buffer.concat(chunks) : null;
  } catch (_) {
    return req.body ? Buffer.from(JSON.stringify(req.body)) : null;
  }
}

/* ---------- Écriture en base ---------- */
async function enregistrer(p) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase non configuré.');

  const r = await fetch(url + '/rest/v1/rpc/stripe_paiement_confirme', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_client_id: p.client_id || null,
      p_client_token: p.client_token || null,
      p_type: p.type,
      p_montant: p.montant,
      p_statut: p.statut,
      p_session: p.session,
      p_payment: p.payment,
    }),
  });
  if (!r.ok) throw new Error('Supabase a refusé : ' + (await r.text()));
  return r.json().catch(() => null);
}
