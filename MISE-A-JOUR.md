# Mise à jour — ce qu'il faut faire

## 1. Exécuter la migration (une fois)

Supabase → **SQL Editor** → collez tout `supabase-migration.sql` → **Run**.

> **Vos données sont préservées.** Ce script n'utilise que des ajouts
> (`create ... if not exists`, `add column if not exists`, `create or replace`).
> Il ne contient **aucun** `drop table`, `delete` ni `truncate`.
> Vos clients, réservations, avis et médias existants restent intacts.
> Il est ré-exécutable sans risque.

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
