# Le Petit Booth — Site & Administration

Site vitrine immersif et back-office complet pour le service de Vidéo Booth
360 **Le Petit Booth** (La Réunion).

## Contenu du projet

```
le-petit-booth/
├── index.html            Site public (one-page immersif)
├── robots.txt            Référencement
├── sitemap.xml           Référencement
├── supabase-schema.sql   Base de données (à exécuter dans Supabase)
├── DEPLOIEMENT.md        ★ Guide de mise en ligne pas à pas
└── admin/                Administration (application React / Vite)
    ├── src/              Code source
    ├── package.json
    └── README.md         Détail technique de l'admin
```

## Le site public (`index.html`)

Fichier autonome. Ouvrez-le dans un navigateur pour le voir immédiatement.
- Portail lumineux animé réactif au défilement, galerie orbitale, formules,
  FAQ, compteur de clients, formulaire de réservation.
- Sans configuration : fonctionne tel quel (le formulaire bascule sur un
  envoi e-mail). Une fois Supabase branché : enregistre les demandes, bloque
  les dates réservées, et affiche le contenu que vous publiez depuis l'admin.

## L'administration (`admin/`)

Back-office pour tout piloter sans toucher au code :
tableau de bord et statistiques · réservations · calendrier · galerie
(glisser-déposer) · avis classiques et vocaux · médiathèque · édition de tous
les textes · formules et tarifs · musique · thème (couleurs, polices, logo,
favicon) · brouillon → prévisualiser → publier · historique des versions.

Accès protégé par un compte Supabase. Icône caméra discrète dans la
navigation du site.

## Pour démarrer

Tout est expliqué, dans l'ordre, dans **`DEPLOIEMENT.md`** :
1. Créer la base Supabase (exécuter `supabase-schema.sql`, créer le compte admin).
2. Configurer et mettre en ligne le site public.
3. Installer, configurer et déployer l'administration.

### Essai rapide de l'admin (sans rien configurer)

```bash
cd admin
npm install
npm run dev
```

Sans fichier `.env`, l'admin démarre en **mode démonstration** (données
fictives, mot de passe `lepetitboothstudio`) pour visualiser l'interface.

## Note technique

L'ensemble a été vérifié statiquement (imports, syntaxe, structure). La
première compilation `npm run build` de l'administration est à lancer dans
votre environnement — voir `admin/README.md`.
