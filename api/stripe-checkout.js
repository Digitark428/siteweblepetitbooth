/**
 * Création d'une session de paiement Stripe.
 *
 * Cette fonction s'exécute sur le SERVEUR (Vercel), jamais dans le navigateur.
 * C'est le seul endroit où la clé secrète est utilisée — elle n'est jamais
 * envoyée au client.
 *
 * Variables d'environnement à renseigner dans Vercel :
 *   STRIPE_SECRET_KEY          sk_live_…   (Settings → Environment Variables)
 *   SUPABASE_URL               https://….supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  clé "service_role" de Supabase
 */

const Stripe = require('stripe');

const TYPES = {
  acompte: "Acompte",
  solde: "Solde",
  total: "Règlement intégral",
};

module.exports = async function handler(req, res) {
  // CORS (le site et l'espace client appellent cette fonction)
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: "Stripe n'est pas configuré sur le serveur." });
  if (!/^sk_live_/.test(secret) && !/^sk_test_/.test(secret)) {
    return res.status(500).json({ error: 'Clé Stripe invalide.' });
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { token, type, retour } = body;

    if (!token) return res.status(400).json({ error: 'Lien client manquant.' });
    if (!TYPES[type]) return res.status(400).json({ error: 'Type de règlement inconnu.' });

    // ---------------------------------------------------------------
    // Le montant est TOUJOURS recalculé côté serveur à partir de la
    // fiche client. On ne fait jamais confiance à un montant envoyé
    // par le navigateur : ce serait la porte ouverte à la fraude.
    // ---------------------------------------------------------------
    const fiche = await getFiche(token);
    if (!fiche) return res.status(404).json({ error: 'Fiche client introuvable.' });

    const calc = calculer(fiche);
    const montant = calc[type];           // en euros
    if (!(montant > 0)) return res.status(400).json({ error: 'Montant nul : rien à régler.' });

    if (type === 'solde' && !calc.acomptePaye) {
      return res.status(400).json({ error: "Le solde ne peut être réglé qu'après l'acompte." });
    }
    if (calc.toutPaye) {
      return res.status(400).json({ error: 'Ce dossier est déjà entièrement réglé.' });
    }

    const nomClient = [fiche.prenom, fiche.nom].filter(Boolean).join(' ') || 'Client';
    const base = retour || process.env.SITE_URL || ('https://' + req.headers.host);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Cartes + moyens locaux. Les facilités de paiement en plusieurs fois
      // proposées par la banque du client apparaissent automatiquement.
      payment_method_types: ['card'],
      customer_email: fiche.email || undefined,
      client_reference_id: String(fiche.id || ''),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(montant * 100),   // Stripe travaille en centimes
          product_data: {
            name: TYPES[type] + ' — Le Petit Booth',
            description: [
              nomClient,
              fiche.typeEvenement,
              fiche.datePrestation ? 'le ' + fiche.datePrestation.split('-').reverse().join('/') : '',
            ].filter(Boolean).join(' · ').slice(0, 250),
          },
        },
      }],
      metadata: {
        client_id: String(fiche.id || ''),
        client_token: String(token),
        type,
        montant: String(montant),
      },
      success_url: base + '#/client/' + token + '?paiement=ok',
      cancel_url: base + '#/client/' + token + '?paiement=annule',
      locale: 'fr',
    });

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('Stripe checkout:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors de la création du paiement.' });
  }
};

/* ---------- Lecture de la fiche client (via Supabase) ---------- */
async function getFiche(token) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase non configuré sur le serveur.');

  const r = await fetch(url + '/rest/v1/rpc/client_by_token', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data || null;
}

/* ---------- Calcul des montants (miroir exact du CRM) ---------- */
function calculer(c) {
  const nb = v => Number(v || 0);
  const options = Array.isArray(c.options) ? c.options.reduce((s, o) => s + nb(o.prix), 0) : 0;
  const sousTotal = nb(c.montant) + options + nb(c.fraisKm);
  const total = Math.max(0, Math.round((sousTotal - nb(c.remise)) * 100) / 100);

  const pct = nb(c.acomptePct) > 0 ? nb(c.acomptePct) : 35;
  const acompte = Math.round(total * pct / 100 * 100) / 100;
  const solde = Math.round((total - acompte) * 100) / 100;

  const factu = c.factu || {};
  const paiements = Array.isArray(c.paiements) ? c.paiements : [];
  const paye = paiements.filter(p => p.statut === 'paye').reduce((s, p) => s + nb(p.montant), 0);

  const acomptePaye = factu.faStatut === 'payee' || factu.paiementStatut === 'complet';
  const toutPaye = factu.paiementStatut === 'complet';

  return { total, acompte, solde, paye, acomptePaye, toutPaye, pct };
}
