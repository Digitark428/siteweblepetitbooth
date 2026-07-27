# Le Petit Booth — Administration (Phase A)

Back-office React (Vite) relié à Supabase. Phase A livrée : connexion
sécurisée, boîte de réception des réservations, gestion du calendrier,
tableau de bord. Les autres sections affichent leur feuille de route
(elles arrivent en phases B, C et D).

## Installation

```bash
cd admin
npm install
cp .env.example .env      # puis renseignez vos deux valeurs Supabase
npm run dev               # http://localhost:5173
```

Sans fichier `.env`, l'admin démarre en **mode démonstration** (données
fictives, mot de passe de test `lepetitboothstudio`) — pratique pour
regarder l'interface avant de brancher la base.

## Brancher Supabase

1. Exécutez `supabase-schema.sql` (à la racine du projet) dans
   Supabase → SQL Editor.
2. Supabase → **Authentication → Users → Add user** : créez votre compte
   admin (e-mail + le mot de passe de votre choix, ex. `lepetitboothstudio`).
   C'est ce compte qui déverrouille l'administration.
3. Supabase → **Settings → API** : copiez l'URL du projet et la clé
   **anon public** dans votre `.env`.
4. `npm run dev` : connectez-vous avec l'e-mail et le mot de passe créés.

## Mettre en ligne

```bash
npm run build     # génère le dossier dist/
```

Déployez `dist/` sous `/admin` de votre site (ou sur un sous-domaine
`admin.lepetitbooth.re`). Sur Vercel/Netlify : pointez le projet sur ce
dossier `admin/`, la commande `npm run build` et le dossier de sortie `dist`.

## Sécurité

La clé anon est publique : ce sont les règles RLS du schéma SQL qui
protègent vos données. Seul un utilisateur **connecté** (votre compte) peut
lire les coordonnées clients et modifier le contenu. Ne mettez jamais la clé
`service_role` dans ce projet.

## Structure

```
src/
├── main.jsx            point d'entrée
├── App.jsx             routage des vues + chargement des données
├── styles.css          thème (couleurs et polices du site)
├── lib/
│   ├── supabase.js     client Supabase
│   ├── auth.jsx        contexte d'authentification
│   └── format.js       formatage des dates
├── components/
│   ├── Login.jsx       écran de connexion
│   └── Shell.jsx       barre latérale + en-tête + navigation
└── views/
    ├── Dashboard.jsx   tableau de bord
    ├── Reservations.jsx boîte de réception
    ├── Calendar.jsx    planning
    └── Soon.jsx        sections des phases suivantes
```

---

## Phase B — Galerie, Avis, Médiathèque (livrée)

- **Galerie** : ajout / modification / suppression de vidéos, réordonnancement
  par glisser-déposer, titre et description, vignette (poster), affichage
  masquable. La vidéo et le poster se choisissent dans la médiathèque.
- **Avis** : deux onglets. *Classiques* (prénom, nom, lieu, photo, texte,
  note en étoiles) et *Vocaux* (photo + fichier audio avec bouton de lecture).
  Nombre illimité, réordonnables, masquables.
- **Médiathèque** : import de photos, vidéos, musiques et audio dans le bucket
  Supabase Storage `medias`, avec aperçu, recherche, filtres par type et
  suppression. Réutilisable partout (galerie, avis, et bientôt musique/logo).

En mode démonstration (sans `.env`), les imports utilisent des URLs locales
temporaires — parfait pour tester l'interface avant de brancher Supabase.

## Phase C — Édition du contenu, thème, musique, publication (livrée)

Nouveau : un document de contenu unique (`site_content`) avec cycle
**brouillon → prévisualiser → publier** et **historique des versions**.

- **Accueil** : titre/sous-titre/accroches du hero, photo de fond (opacité,
  centrage), lignes du manifeste (ajout/suppression), compteur de clients.
- **Formules** : prix, noms, accroches, lignes incluses (ajout/retrait),
  choix de la formule mise en avant, texte sur-mesure.
- **Musique** : piste depuis la médiathèque, volume, lecture auto, boucle,
  activation.
- **Paramètres** : couleurs, polices, logo, favicon, coordonnées et réseaux,
  **historique des versions** (restaurer une version publiée).
- **Barre supérieure** : indicateur « modifications non publiées », boutons
  **Annuler** (revenir à la version en ligne), **Prévisualiser**, **Publier**.
  Le brouillon est sauvegardé automatiquement pendant la saisie.

### À intégrer ensuite (étape d'hydratation)
L'admin publie désormais le contenu dans Supabase, mais le **site public**
(`index.html`) ne le lit pas encore : il faut lui ajouter un petit script qui
récupère la version publiée (fonction `get_published_content`) et l'applique.
Cette étape est prévue avec la Phase D.

## Phase D — Statistiques réelles + hydratation du site public (livrée)

**Mesure d'audience** — le site public envoie désormais des événements à
Supabase (`analytics_events`) : visite, clic « Réserver », lecture de vidéo,
écoute d'un témoignage vocal, avec le type d'appareil. Le tableau de bord
affiche les vraies courbes (visiteurs 7 jours, répartition mobile/ordinateur/
tablette) dès qu'il y a des données ; sinon il montre un exemple.

**Hydratation** — `index.html` lit maintenant la version **publiée** depuis
Supabase (`get_published_content`) et l'applique automatiquement : textes du
hero, photo de fond, manifeste, compteur, formules, sur-mesure, couleurs du
thème, coordonnées, galerie (vidéos visibles) et avis (classiques + vocaux).
Sans Supabase configuré, le site garde ses textes par défaut — aucun risque.

### Le circuit complet
1. Vous modifiez dans l'admin → **Publier**.
2. `get_published_content` renvoie la nouvelle version.
3. Le site l'affiche au prochain chargement.

Vous pilotez désormais 100 % du site sans toucher au code.
