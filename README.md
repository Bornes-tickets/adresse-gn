# Adresse Directe

Sprint 1 – Fondations. Référence : §3 et §4 du cahier des charges attaché.

Contexte imposé (à respecter absolument) :

- Stack : React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase.

- Backend uniquement Supabase (aucun autre).

- Toutes les tables en RLS activée.

- Textes en français.

- Auth : email + password uniquement pour ce sprint (pas d'OTP SMS).

- Commit conventionnel après chaque étape.

Fais dans cet ordre, en t'arrêtant si une étape échoue :

1) Configure le thème :

   - Couleur primaire #2E4A7B, accent #0EA5A4, fond #F8FAFC, texte #0F172A.

   - Typo : Inter (partout) + JetBrains Mono (pour le numéro de balise).

   - Radius 0.75rem.

   - Édite tailwind.config.ts, src/index.css et App.css.

2) Crée la migration SQL initiale dans supabase/migrations/ :

   - Active l'extension postgis.

   - Crée les tables : profiles, regions, communes, districts, beacons,

     addresses, establishments, establishment_photos, installations,

     installation_measures, lots, orders, payments, subscriptions, invoices,

     reports, favorites, search_logs, route_logs, audit_logs, api_keys,

     api_usage, organizations, agents, notifications.

   - Respecte le schéma détaillé au §4.1 du cahier des charges attaché.

   - Ajoute les index (GIST sur addresses.location, UNIQUE sur beacons.public_number,

     GIN full-text sur establishments, index sur status).

   - Un trigger sur auth.users pour créer automatiquement une ligne dans profiles.

3) Active la Row Level Security sur TOUTES les tables et crée les policies :

   - addresses : SELECT public si visibility='public' AND status='active' ;

     SELECT complet si owner_id=auth.uid() ou role in (admin,supervisor) ;

     INSERT/UPDATE selon rôle.

   - beacons, installations, payments, audit_logs : selon §5.2 du cahier des charges.

   - profiles : SELECT/UPDATE si id=auth.uid().

   - Aucune table sans policy.

4) Crée la fonction PostgreSQL search_by_number(p_number TEXT)

   avec SECURITY DEFINER, qui retourne uniquement les champs publics

   + coordonnées + établissement lié (§5.3 du cahier).

5) Configure Supabase Auth pour email + password uniquement.

   Pages : /login, /signup, /logout.

   Redirect après login vers /.

6) Génère les types TypeScript Supabase dans src/integrations/supabase/types.ts.

7) Crée le layout général src/components/Layout.tsx :

   - Header avec logo texte "ADRESSE GN" (couleur primaire, gras) et tagline

     "Un lieu · Un numéro · Un itinéraire".

   - Bouton Se connecter / avatar utilisateur selon état.

   - Footer sobre avec mentions légales, liens vers /a-propos et /confidentialite (pages stubs).

8) Crée la page d'accueil src/pages/Home.tsx :

   - Grand titre "Trouvez une adresse en un numéro".

   - Sous-titre explicatif court.

   - Champ de recherche mono-large "GN-CKY-______" en JetBrains Mono.

   - Bouton "Rechercher" (couleur accent, grand).

   - Bouton icône scanner QR à droite du champ (non fonctionnel ce sprint,

     tooltip "Bientôt disponible").

   - 3 exemples cliquables sous le champ (GN-CKY-582741, GN-CKY-152963, GN-CKY-759482).

   - Section explicative en 3 étapes (Numéro → Localisation → Itinéraire).

9) Crée src/pages/BeaconResult.tsx à la route /a/:number :

   - Appelle la RPC search_by_number.

   - Pour ce sprint, affiche seulement le JSON brut de la réponse dans un pre stylisé.

   - Si non trouvé, affiche un message clair.

10) Crée supabase/seed.sql avec 5 balises de démo à Conakry

    (Kaloum, Kipé, Ratoma, Matam, Dixinn) et leurs adresses associées

    (2 restaurants publics, 1 hôtel public, 2 habitations privées).

À la fin, résume ce que tu as fait, liste les fichiers créés, et confirme

que la sync GitHub s'est bien effectuée avec le commit conventionnel.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/687b8cfd-6e8c-418d-9238-75bbb3b04767).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
