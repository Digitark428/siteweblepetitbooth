# Diagnostic — Dépassement Cached Egress (24 Go / 5 Go)

## D'où vient le trafic : Storage, pas PostgREST

Le « Cached Egress » de Supabase correspond aux fichiers servis par le **CDN devant le
Storage** (images, vidéos, audio). Les requêtes de base de données (PostgREST) sont
minuscules ici : le chargement complet du site public fait 4 requêtes JSON de quelques Ko,
et le CRM interroge une vue de 12 lignes. Même avec des milliers de visites, cela
représenterait quelques dizaines de Mo, pas 24 Go.

Le Storage, lui, contient 120 Mo de médias (Storage Size : 0,12 Go). 24 Go d'egress =
**ces mêmes fichiers servis environ 200 fois chacun**. C'est exactement la signature d'un
site public qui re-télécharge ses gros médias à chaque visite.

Point important : les « 4 MAU » ne comptent que les utilisateurs **authentifiés** (vous
dans l'admin). Les visiteurs anonymes du site public ne sont PAS comptés — il peut y en
avoir des centaines par mois, et chacun déclenchait les téléchargements ci-dessous.

## Les 5 fuites identifiées (par ordre de gravité)

### 1. La musique de fond — `index.html`, fonction `setupMusic()`
```js
audio.preload = 'auto';   // ← LA fuite principale
```
`preload='auto'` force le téléchargement **intégral du MP3 dès l'arrivée sur la page**,
pour chaque visiteur, même quand l'autoplay est bloqué par le navigateur (cas quasi
systématique pour un son non muet : Chrome/Safari bloquent, mais le fichier est déjà
téléchargé). Un MP3 de 5-8 Mo × chaque visite × re-téléchargement toutes les heures
(voir fuite n° 4) = plusieurs Go/mois à lui seul.
**Corrigé** : `preload='none'` — le fichier n'est chargé qu'à la première lecture réelle.

### 2. Les vignettes vidéo de la galerie — `index.html`, fonction `initGallery()`
```js
'<video src="' + it.src + '#t=0.1" muted playsinline preload="metadata"></video>'
```
Pour chaque vidéo **sans poster**, le navigateur téléchargeait un morceau du MP4 juste
pour afficher une image fixe. Pire : si le MP4 n'est pas encodé « fast start » (atome
`moov` à la fin du fichier, cas fréquent), le navigateur doit télécharger **presque toute
la vidéo** pour lire les métadonnées. 6 vidéos × 20-50 Mo × chaque visite = la deuxième
source majeure du dépassement.
**Corrigé** : visuel dégradé neutre à la place ; la vidéo n'est téléchargée qu'au clic.
→ **Action recommandée** : renseignez un poster JPEG pour chaque vidéo dans l'admin.

### 3. Photos et hero servis en pleine résolution
`renderPhotos()` affiche les originaux (souvent 3-8 Mo pour une photo de téléphone) en
simples vignettes de grille, et la photo du hero est chargée telle quelle à chaque visite.
Les transformations d'images Supabase ne sont pas disponibles sur le plan gratuit.
**Corrigé** : `uploadMedia()` compresse désormais les images **côté navigateur avant
l'envoi** (max 1 920 px, JPEG 82 % ≈ 300-600 Ko, soit ~10× moins de trafic).
→ **Action recommandée** : ré-importez via la Médiathèque la photo du hero et les photos
de la grille, puis re-sélectionnez-les — les anciens originaux lourds resteront sinon servis.

### 4. Cache navigateur d'une heure seulement — tous les uploads
Aucun `cacheControl` n'était passé à `storage.upload()`, donc Supabase appliquait
`max-age=3600` : chaque navigateur **jetait son cache au bout d'une heure** et
re-téléchargeait musique, photos et vidéos à la visite suivante. C'est l'amplificateur
des fuites 1 à 3.
**Corrigé** : `cacheControl: '31536000'` (1 an) dans `admin/src/lib/media.js` et
`avis.html`. Sans risque : les noms de fichiers sont horodatés, jamais réutilisés.
⚠️ Ne s'applique qu'aux **nouveaux** uploads — d'où l'intérêt de ré-importer les médias
lourds existants (hero, musique, posters).

### 5. Fuites secondaires (admin/CRM)
- `Media.jsx` et `MediaPicker.jsx` : `<video src=…>` sans `preload` → à chaque ouverture
  de la Médiathèque, des morceaux de **toutes** les vidéos étaient téléchargés.
  Corrigé : `preload="none"`.
- `crm.html` : `setInterval(chargerPaiements, 60000)` tournait même onglet caché
  (1 440 requêtes/jour par onglet oublié). Corrigé : interrogation seulement si l'onglet
  est visible, toutes les 2 min, + rafraîchissement immédiat au retour sur l'onglet.

## Ce qui a été vérifié et est SAIN
- Aucune boucle infinie ni `useEffect` mal dépendancé : `App.jsx`, `content.jsx`,
  `Media.jsx`, `Dashboard.jsx` chargent une seule fois par session (`[session, load]`
  avec `load` mémoïsé par `useCallback([])`).
- Aucun abonnement Realtime dans le projet (0 connexion au compteur, cohérent).
- Aucun `location.reload()` ni rafraîchissement automatique du site public.
- Le hero `<video>` a déjà `preload="none"` : correct.

## Vérification côté Supabase (recommandée)
Dashboard → **Reports → Storage** : vous verrez les objets les plus servis (la musique et
les MP4 de la galerie devraient dominer très nettement). **Reports → API** confirmera que
PostgREST ne pèse presque rien. Cela valide le diagnostic Storage vs base de données.

## Après déploiement, dans l'ordre
1. Déployer cette version (Vercel).
2. Ré-importer via la Médiathèque : la musique, la photo du hero, les photos de la grille,
   les posters de galerie → re-sélectionner chacun dans les écrans concernés
   (les nouveaux fichiers seront compressés + cache 1 an).
3. Facultatif mais efficace : ré-encoder les MP4 de galerie en « fast start »
   (`ffmpeg -i in.mp4 -movflags +faststart -c copy out.mp4`) et viser ≤ 15 Mo par vidéo.
4. Supprimer de la Médiathèque les anciens fichiers lourds devenus inutiles.

Résultat attendu : consommation divisée par 20 à 50 — largement sous les 5 Go du plan
gratuit, même avec beaucoup plus de visiteurs.
