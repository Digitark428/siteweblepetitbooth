# Le Petit Booth — Guide de mise en ligne

Trois briques à mettre en place, dans cet ordre : **Supabase** (la base),
le **site public**, puis l'**administration**. Comptez 30 à 45 minutes.

---

## 1. Supabase (la base de données)

1. Créez un compte sur supabase.com et un nouveau projet (région Europe
   conseillée). Notez le mot de passe de la base.
2. Menu **SQL Editor** → collez tout le contenu de `supabase-schema.sql` →
   **Run**. Cela crée les tables, les règles de sécurité, le bucket de
   fichiers et les vues.
3. Menu **Authentication → Users → Add user** → créez votre compte :
   - e-mail : le vôtre
   - mot de passe : `lepetitboothstudio` (modifiable ensuite ici même)
   - cochez « Auto Confirm User ».
   C'est ce compte qui déverrouille l'administration.
4. Menu **Settings → API** : copiez deux valeurs, gardez-les de côté :
   - **Project URL** (ex. `https://abcd.supabase.co`)
   - **anon public** (une longue clé `eyJ...`)

> La clé anon est faite pour être publique : ce sont les règles du script SQL
> qui protègent vos données. Ne copiez **jamais** la clé `service_role`.

---

## 2. Site public

1. Ouvrez `index.html`, trouvez le bloc `CONFIG` (vers le début du script) et
   renseignez :
   ```js
   supabaseUrl: 'https://abcd.supabase.co',
   supabaseAnonKey: 'eyJ...votre-cle-anon...',
   ```
2. Remplacez partout `https://lepetitbooth.re/` par votre vraie adresse
   (dans `index.html` et `sitemap.xml`).
3. Déposez vos médias dans un dossier `assets/` (favicon, image Open Graph…).
4. Mise en ligne — au choix :
   - **Netlify / Vercel** : glissez le dossier du projet, ou connectez le
     dépôt GitHub. Rien à configurer, c'est statique.
   - **GitHub Pages** : activez Pages sur la branche `main`. Si l'URL est de
     la forme `login.github.io/lepetitbooth/` (sous-dossier), dites-le-moi :
     il faudra passer quelques chemins en relatifs.

À ce stade le site fonctionne déjà : le formulaire enregistre les demandes,
le calendrier lit les dates bloquées, et l'hydratation applique le contenu
publié.

---

## 3. Administration

1. Dans le dossier `admin/` :
   ```bash
   npm install
   cp .env.example .env
   ```
2. Ouvrez `.env` et collez vos deux valeurs Supabase :
   ```
   VITE_SUPABASE_URL=https://abcd.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...votre-cle-anon...
   ```
3. Test en local :
   ```bash
   npm run dev
   ```
   Ouvrez l'adresse affichée, connectez-vous avec l'e-mail et le mot de passe
   créés à l'étape 1.3.
4. Mise en ligne :
   ```bash
   npm run build
   ```
   Déployez le dossier `admin/dist` :
   - **Sous `/admin` de votre site** (recommandé) : placez le contenu de
     `dist` dans un dossier `admin` à côté de `index.html`. L'icône caméra du
     site pointe déjà vers `./admin/`.
   - **Ou sur un sous-domaine** `admin.lepetitbooth.re` (nouveau projet
     Netlify/Vercel pointant sur `admin/`, build `npm run build`, dossier de
     sortie `dist`). Dans ce cas, changez le lien de l'icône caméra dans
     `index.html`.

---

## 4. Vérifier que tout marche

1. **Réservation** : envoyez une demande de test depuis le site → elle doit
   apparaître dans l'admin, section « Réservations », avec le badge.
2. **Publication** : dans l'admin, changez le titre du hero → **Publier** →
   rechargez le site : le nouveau titre s'affiche.
3. **Calendrier** : ajoutez une date confirmée → elle se bloque sur le
   calendrier du formulaire de réservation.
4. **Médias** : importez une photo → elle doit apparaître dans la
   médiathèque (et dans Supabase → Storage → bucket `medias`).

---

## 5. Petite check-list sécurité

- [ ] Le script SQL a bien été exécuté (les règles RLS sont actives).
- [ ] Seule la clé **anon** est utilisée (jamais `service_role`).
- [ ] Le compte admin a un mot de passe que vous seul connaissez
      (changez `lepetitboothstudio` une fois en ligne).
- [ ] Le fichier `.env` de l'admin n'est **pas** publié sur GitHub
      (ajoutez-le à `.gitignore`).

---

En cas de blocage à n'importe quelle étape — un message d'erreur au
`npm run build`, une demande qui n'arrive pas, l'hydratation qui ne
s'applique pas — notez le message exact et on le règle.
