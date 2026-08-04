# Activer les paiements Stripe (production)

## ⚠️ D'ABORD : régénérez votre clé secrète

Votre clé secrète a été transmise dans une conversation : considérez-la comme
compromise. Elle permet de débiter, rembourser et lire tout votre compte.

1. [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
2. À côté de la clé secrète → **Roll key** (régénérer)
3. Copiez la nouvelle clé — vous ne la collerez QUE dans Vercel (étape 2)

**Ne mettez jamais une clé `sk_` dans le code du site.** Le site est servi au
navigateur : tout visiteur pourrait la lire. Seule la clé `pk_` (publique) est
faite pour être visible.

---

## 1. Exécuter le SQL

Supabase → SQL Editor → **`supabase-TOUT-EN-UN.sql`** → **Run**.

> Ce fichier contient **tout le projet**, Stripe compris. C'est le seul à
> exécuter. Non destructif, ré-exécutable — vos données sont conservées.

## 2. Variables d'environnement dans Vercel

Vercel → votre projet → **Settings → Environment Variables**.
Ajoutez ces quatre variables (Production) :

| Nom | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | votre **nouvelle** clé `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (obtenu à l'étape 3) |
| `SUPABASE_URL` | `https://dyywfebfhwlhwufmafpm.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** |

> La clé `service_role` est elle aussi ultra-sensible : elle ne va QUE dans
> Vercel, jamais dans le code.

Optionnel : `SITE_URL` = l'adresse de votre site (améliore les redirections).

## 3. Déclarer le webhook chez Stripe

Stripe → **Developers → Webhooks → Add endpoint**

- **URL** : `https://votre-site.vercel.app/api/stripe-webhook`
- **Événements** : `checkout.session.completed` et `charge.refunded`

Stripe affiche alors un **Signing secret** (`whsec_…`) : c'est la valeur de
`STRIPE_WEBHOOK_SECRET` à l'étape 2. Redéployez après l'avoir ajoutée.

## 4. Clé publique dans le CRM

CRM → onglet **Facturation** → section « Paiement en ligne » :

- **Clé publique Stripe** : `pk_live_51S3TbdFo3K8ELTAH…` (la vôtre, celle-ci
  est publique par nature)
- Cochez **Stripe actif**
- **Enregistrer les paramètres**

## 5. Redéployer

Envoyez le projet sur GitHub → Vercel redéploie et installe Stripe
automatiquement.

---

# Comment ça marche

**Le client** ouvre son lien privé et voit trois boutons : *Régler l'acompte*,
*Régler le solde* (actif après l'acompte), *Régler la totalité*. Sous les
boutons, un message indique que le paiement en plusieurs fois sera proposé par
Stripe si sa carte est éligible.

Il clique → il est redirigé vers la page de paiement sécurisée Stripe → il paie
→ il revient sur son espace avec un bandeau de confirmation.

**Le montant est recalculé sur le serveur**, jamais transmis par le navigateur.
Personne ne peut modifier le prix depuis sa page.

**Vous** êtes averti : le tableau de bord du CRM affiche
« 🔔 1 nouveau paiement » avec le nom du client, le type et le montant. Un
bouton « Marquer comme lus » efface la pastille. La liste se rafraîchit toute
seule chaque minute.

**La fiche client se met à jour automatiquement** dès que Stripe confirme :

| Paiement reçu | Effet |
|---|---|
| Acompte | Facture d'acompte → *Payée* · Devis → *Accepté* · Solde → *À payer* · Pipeline → *Date bloquée – acompte reçu* |
| Solde | Facture de solde → *Payée* · Dossier → *Paiement complet* · Pipeline → *Date bloquée – solde reçu* |
| Totalité | Toutes les factures → *Payées* · Dossier → *Paiement complet* |
| Remboursement | Dossier → *Remboursé* |

Le client voit les mêmes informations dans son espace, et quand tout est réglé :
« ✅ Votre dossier est intégralement réglé ».

---

# Sécurité — ce qui est en place

- La clé secrète vit **uniquement** sur le serveur Vercel, dans une variable
  d'environnement. Elle n'apparaît nulle part dans le code.
- Le montant est **recalculé côté serveur** depuis la fiche client. Un montant
  falsifié par le navigateur est ignoré.
- Le webhook **vérifie la signature Stripe**. Si la signature est absente, il
  relit l'événement directement chez Stripe : un faux paiement est rejeté.
- **Anti-doublon** : si Stripe renvoie deux fois le même événement, le paiement
  n'est compté qu'une fois.
- Le solde ne peut pas être réglé avant l'acompte, et un dossier déjà soldé
  refuse tout nouveau paiement.
- La fonction qui valide les paiements en base est **inaccessible depuis un
  navigateur** (réservée au serveur).

---

# Vérifier que tout fonctionne

Faites un vrai test à petit montant :

1. Créez une fiche client test avec un montant de 1 € et un acompte de 100 %.
2. Ouvrez son lien privé, cliquez sur **Régler l'acompte**.
3. Payez avec votre vraie carte (c'est du mode production : 1 € sera débité).
4. Vérifiez : le bandeau vert apparaît, la fiche passe en « acompte reçu »,
   et le tableau de bord affiche la notification.
5. Remboursez-vous depuis Stripe → le dossier passe en « Remboursé ».

Si le paiement n'aboutit pas, regardez Vercel → **Deployments → Functions →
Logs** : l'erreur exacte y figure.
