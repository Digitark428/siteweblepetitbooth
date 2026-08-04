# Mise à jour — ce qu'il faut faire

## 1. Exécuter le SQL (une fois)

Supabase → **SQL Editor** → nouvelle requête → collez **`supabase-TOUT-EN-UN.sql`** → **Run**.

> **Un seul fichier suffit.** Il contient tout : fondations du site, CRM,
> avis par lien, synchronisation du calendrier, musiques client,
> statistiques et facturation.
>
> Les fichiers `supabase-schema.sql`, `supabase-migration.sql` et
> `supabase-facturation.sql` restent fournis à titre de référence, mais
> vous n'avez **pas** besoin de les exécuter séparément.
>
> **Vos données sont préservées.** Uniquement des ajouts
> (`create ... if not exists`, `add column if not exists`,
> `create or replace`). Aucun `drop table`, `delete` ni `truncate`.
> Ré-exécutable sans risque, même si vous avez déjà lancé d'autres scripts.

## 2. Redéployer

Envoyez le contenu du dossier sur GitHub → Vercel redéploie tout seul.

---

# Ce qui a changé

## Partie publique

**Compteur d'événements** — le nombre et le texte se modifient dans
l'administration (Accueil → Compteur), puis **Enregistrer**.

**Avis clients** — deux carrousels distincts : *Avis écrits* puis *Avis vocaux*.
Même défilement horizontal, même design, même animation qu'avant.

**Calendrier**
- Dates **disponibles** : fond vert pastel, texte lisible.
- Dates **devis** et **réservées** : texte plus épais.
- **Bug de date corrigé** : le site convertissait les dates en heure
  universelle alors que La Réunion est à UTC+4, ce qui décalait tout d'un
  jour (le 1er août bloquait le 2). Les dates sont désormais calculées en
  heure locale.

**Formulaires d'avis par lien** (`avis.html`)
Dans l'administration → **Avis** → bouton **« Inviter un client »** :
un lien est généré, à envoyer par SMS, WhatsApp ou e-mail.
- Onglet *Avis classiques* → lien de formulaire écrit
- Onglet *Avis vocaux* → lien avec **enregistrement micro** directement
  dans le navigateur (minuteur, réécoute, 2 minutes max)

Le client saisit prénom, nom, événement, étoiles, commentaire et photo.
**L'avis est publié automatiquement** dans la bonne catégorie. Aucune
intervention manuelle.

## CRM

**Prestations** — Essentiel 390 €, Expérience 590 €, Signature 990 €,
et une nouvelle **Prestation personnalisée** : le nom et le prix sont libres
(un champ « Nom de la prestation » apparaît quand vous la sélectionnez).

**Pipeline** — six étapes :
Demande reçue · Devis envoyé · En attente de réponse ·
**Date bloquée – acompte reçu** · **Date bloquée – solde reçu** ·
Prestation terminée

**Musiques du client** — dans son espace personnel, le client renseigne
jusqu'à 4 morceaux (titre + artiste). Ils remontent automatiquement dans sa
fiche CRM, section « Musiques choisies par le client ».

**Synchronisation CRM → calendrier public**
Le CRM devient la source principale. Une date de fiche client bloque
automatiquement le calendrier :
- acompte reçu / solde reçu / terminé → date **réservée**
- devis envoyé / en attente → date **en attente (devis)**
- demande reçue → aucun blocage

Les dates bloquées à la main dans l'administration continuent de
fonctionner : le calendrier fusionne les deux sources. Plus de double saisie.

## Tableau de bord

Statistiques réelles : visiteurs du jour et du mois, clics « Réserver »,
demandes reçues, taux de conversion, lectures de vidéos, écoutes de
témoignages. Si aucune visite n'est encore enregistrée, un message l'indique
clairement (ce n'est pas une panne : la mesure démarre à la première visite).

---

# À tester après déploiement

1. **Calendrier** : bloquez une date dans l'administration → vérifiez que
   c'est bien **le même jour** qui se bloque sur le site.
2. **CRM → calendrier** : passez un client en « Date bloquée – acompte reçu »
   → sa date doit apparaître réservée sur le site.
3. **Avis** : générez un lien, ouvrez-le, envoyez un avis test → il doit
   apparaître sur le site dans la bonne catégorie.
4. **Avis vocal** : même chose avec l'enregistrement micro (autorisez le
   micro quand le navigateur le demande).
5. **Musiques** : ouvrez le lien client, saisissez une musique, enregistrez →
   elle doit apparaître dans la fiche CRM.
6. **Compteur** : changez le nombre dans l'administration, **Enregistrer**,
   rechargez le site.

En cas de souci, ouvrez la console du navigateur (F12) : les messages
`[CMS]` en violet indiquent précisément ce qui est chargé ou ce qui bloque.

---

# Module facturation (nouveau)

## À exécuter

Supabase → SQL Editor → `supabase-facturation.sql` → **Run**.
Non destructif, ré-exécutable.

## Comment ça marche

**1. Réglages** — onglet **Facturation** dans le CRM : coordonnées, logo,
IBAN/BIC, SIREN, mentions légales, textes des devis et factures, conditions
générales, délais, taux d'acompte (35 % par défaut), numéros de départ.

**2. Fiche client** — nouveaux champs : adresse, code postal, ville, pays
(France par défaut), frais de déplacement et remise.

**3. Génération** — bouton **« Générer les documents »** : crée d'un coup le
devis, la facture d'acompte (35 %), la facture de solde (65 %) et la facture
globale. Chaque PDF reprend automatiquement le client, la prestation, les
options, les frais de déplacement, la remise, les montants et les dates.

**4. Numérotation automatique** — D/20, FA/13, FS/7, F/17… Les numéros sont
attribués par la base de façon atomique : jamais de doublon, jamais de saisie
manuelle. Une régénération conserve le numéro d'origine.

**5. Archivage** — les documents s'affichent dans la fiche client. Vous pouvez
les **ouvrir**, **télécharger**, **régénérer** ou **supprimer**.

**6. Espace client** — le client retrouve ses documents dans son lien privé,
avec aperçu et téléchargement.

**7. Récapitulatif financier** — montant total, acompte, solde, déjà payé,
reste à payer, statut du dossier, historique des paiements et des documents.

**8. Statuts** — devis (brouillon/envoyé/accepté/refusé), facture d'acompte
(à payer/payée), facture de solde (en attente/à payer/payée), facture globale
(à payer/payée), paiement (aucun/acompte/complet/plusieurs fois/remboursé).

**9. Paiements** — quatre boutons : acompte (35 %), totalité (100 %), solde
(65 %, actif seulement si l'acompte est payé), et paiement en plusieurs fois.

> **Stripe n'est pas connecté**, comme demandé. Aujourd'hui, ces boutons
> enregistrent le règlement manuellement (virement, espèces…) et mettent à
> jour tous les statuts. Le jour où vous renseignerez vos clés Stripe dans
> l'onglet Facturation et cocherez « Stripe actif », les mêmes boutons
> ouvriront le paiement en ligne. La table `paiements` et la fonction
> `paiement_enregistrer` attendent déjà les identifiants Stripe : il ne
> restera qu'à brancher la passerelle, sans rien refaire.

## À savoir

- Les PDF sont générés **dans votre navigateur** (aucun service externe) et
  stockés dans la fiche client. Comptez 30 à 60 Ko par document.
- La première génération télécharge la librairie PDF : prévoyez une connexion
  active la première fois.
- Autorisez les **fenêtres pop-up** pour l'aperçu des documents.
