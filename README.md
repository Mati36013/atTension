# atTension (prototype, interface patient)

**Lancer dans VS Code**
1. Ouvrir ce dossier dans VS Code, installer l'extension « Live Server ».
2. Clic droit sur `index.html` > « Open with Live Server ». (Ouvrir le fichier directement ne fonctionne pas.)
3. Sur Android : ouvrir le lien (HTTPS requis hors de l'ordinateur) dans Chrome > menu > « Installer l'application ».

**Où modifier quoi**
- `config.js` : seuils, rappels, durées. Les `NOTE:` listent ce qui reste à valider ou à ajouter.
- `aide.js` : questions de la page Aide (FR/EN). `export.js` : export PDF et Excel (sans bibliothèque externe).
- `supa.js` : client Supabase (connexion, tables, fonctions) sans bibliothèque. `sync.js` : synchronisation (lecture, file d'envoi, sondage de la messagerie). `config.js` contient l'URL et la clé publique de Supabase.
- `i18n.js` : textes FR/EN. `data.js` : copie locale, statistiques, données fictives. `app.js` : écrans. `style.css` : apparence.

Depuis la v8.0, les comptes, mesures, symptômes et messages sont dans Supabase (une copie est gardée sur l'appareil pour la rapidité et le hors ligne). N'y entrer que des données fictives.

**Revoir les données de démonstration** : elles sont stockées dans le navigateur, pas dans les fichiers. Ouvrir l'adresse de l'app avec `?reset` (ex. `http://127.0.0.1:5500/?reset`).
Les polices (Nunito, Playfair Display) viennent de Google Fonts : internet est requis à la première ouverture, ensuite elles sont mises en cache.

**Sur téléphone, sans VS Code** : voir le document « atTension – Guide d’utilisation mobile ».

**Interface médecin** (ordinateur) : connexion « Médecin » avec le compte de test défini dans `config.js` (comptes).

**Comptes, profil et paramètres (v0.6)** : création de compte patient et médecin (3 étapes), profil, paramètres (langue, apparence, rappels, mot de passe, suppression). Comptes stockés sur l'appareil seulement (aucune sécurité). Les comptes de test (patient « Test », médecin 12345678) sont recréés à chaque ouverture s'ils sont supprimés. Seul le médecin de test est « vérifié » ; un médecin créé dans l'app reste en attente de vérification.

**Version 7.0** : menu médecin réorganisé (Accueil en haut ; profil et paramètres en bas), profil et paramètres en vue ordinateur côté médecin, bouton clair/sombre retiré de la page médecin, page Aide, export PDF puis Excel (Profil, Paramètres ou Symptômes > « Exporter »). Détails et points ouverts : page Notion « Documentation atTension (Version 7.0) ».

**Version 8.0** : Supabase (base de données, authentification, messagerie réelle patient ↔ médecin). Les identifiants de test (Test, 12345678) sont convertis en courriels (`config.js`, `supabase.connexions`) ; les mots de passe ne sont plus dans le code. Scripts SQL : `supabase_attension.sql` (base) puis `supabase_attension_v8_ajouts.sql` (ajouts). La clé `service_role` ne doit jamais être mise dans le code. Détails : page Notion de la version 8.0.

**Version 8.1** : la messagerie du menu de gauche (interface médecin) ouvre maintenant la conversation avec chaque patient ; textes mis à jour (données de la base).

**Version 8.2** : passage de sécurité avant publication : pièces jointes et données de la base validées côté application (aucune injection possible dans la page du médecin), politique de contenu (CSP) dans index.html et `_headers` (Netlify/Cloudflare), anti-clickjacking, cœur et icônes originaux, LICENSE.txt, service worker limité à nos fichiers. Script SQL : `supabase_attension_v8_securite.sql` (contraintes et vérifications).

**Version 8.3** : politique de confidentialité (FR/EN) dans `privacy.js` (à modifier à cet endroit seulement) ; accessible depuis l'accueil, l'étape Confidentialité de la création de compte et Paramètres. Le courriel de contact se règle dans `config.js` (`contactConfidentialite`).
