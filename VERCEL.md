# Mise en ligne sur Vercel — un seul projet (le plus simple)

Ce projet est configuré pour se déployer **en une seule fois** sur Vercel :
Vercel compile l'administration automatiquement et sert le site public + l'admin
ensemble. Pas de terminal nécessaire.

## Réglages du projet Vercel

Dans votre projet Vercel → **Settings → Build & Deployment** (ou à la création
du projet), mettez exactement :

- **Framework Preset** : Other
- **Build Command** : `npm run build`
- **Output Directory** : `dist-site`
- **Install Command** : laissez par défaut

## Variables d'environnement

Toujours dans Vercel → **Settings → Environment Variables**, ajoutez vos deux
valeurs Supabase (Supabase → Settings → API) :

- `VITE_SUPABASE_URL` = `https://xxxx.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `eyJ...`

Elles servent à l'administration au moment de la compilation.

## Ensuite

1. Renseignez aussi le bloc `CONFIG` en haut du script de `index.html` avec les
   deux mêmes valeurs (c'est ce qui permet au site public d'afficher le contenu
   que vous publiez et d'enregistrer les réservations).
2. Redéployez (Vercel → Deployments → Redeploy, ou un nouveau push).

## Résultat

- `votre-site.vercel.app/` → le site public
- `votre-site.vercel.app/admin/` → l'administration (l'icône caméra y mène déjà)

## Si le déploiement échoue

Ouvrez l'onglet **Deployments** → cliquez sur le déploiement en échec → lisez le
**Build Log** (le texte rouge). Copiez-moi les dernières lignes, je corrige.
