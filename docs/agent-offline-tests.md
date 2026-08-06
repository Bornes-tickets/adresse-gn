# Tests manuels — mode offline de l'app agent (Sprint 3C)

À exécuter sur un smartphone réel (Android Chrome et/ou iOS Safari), app installée en PWA,
avec un compte agent disposant de balises assignées (ex. lot `LOT-DEMO-001`).

## 1. Trois installations en mode avion
1. Ouvrir `/agent/tasks` **en ligne** (charge la liste et remplit le cache local).
2. Activer le mode avion.
3. Enchaîner 3 installations complètes (balise, 3 mesures GPS, photo, détails, consentement).
4. Attendu : à chaque validation, écran « enregistrée localement — synchronisée dès la reconnexion ».

## 2. Vérifier la file d'attente
- Bandeau en haut : orange « Hors ligne — 3 en attente ».
- DevTools → Application → IndexedDB → `adresse-gn-agent` → `install_queue` :
  3 lignes `status='pending'`, chacune avec un `client_uuid` distinct et un `photo_blob` non vide.

## 3. Reconnexion et sync automatique
1. Désactiver le mode avion.
2. Attendu : la synchronisation démarre seule (événement `online`), sinon dans les 60 s.
3. Bandeau : bleu « En ligne — X en attente » puis vert « En ligne ».
4. `/agent/history` affiche les 3 installations ; `install_queue` est vide (les `done` sont purgés).

## 4. Absence de doublons côté serveur
- Pour chaque balise : une seule ligne dans `installations` et une seule dans `addresses`.
- Relancer manuellement « Synchroniser » : aucun nouvel enregistrement (idempotence `client_uuid`).
- Vérification SQL :
  ```sql
  select client_uuid, count(*) from installations
  where client_uuid is not null group by 1 having count(*) > 1;
  ```
  doit renvoyer 0 ligne.

## 5. Envoi partiel (coupure entre deux installations)
1. Mettre 2 installations en file (mode avion).
2. Rétablir le réseau, puis le couper pendant la synchronisation.
3. Attendu : l'installation envoyée passe `done`, l'autre repasse `error` avec `attempts` incrémenté
   et une nouvelle tentative planifiée (backoff 5 s → 15 s → 45 s → 2 min → 5 min → 15 min).
4. Au retour du réseau : la restante se synchronise, sans doublon de la première.

## 6. Fermeture / réouverture hors ligne
1. Avec des éléments en attente, fermer complètement l'app (pas seulement l'onglet).
2. Rester hors ligne, rouvrir l'app.
3. Attendu : la file est intacte (compteur identique), les photos toujours présentes,
   `/agent/tasks` affiche le cache avec « Cache — dernière mise à jour à HH:MM »,
   et lancer une installation depuis une tâche cachée reste possible.

## 7. Erreurs métier
- Tenter une installation hors ligne sur une balise non assignée : après reconnexion elle apparaît
  dans `/agent/sync-issues` avec le message serveur, boutons « Réessayer », « Voir détails »,
  « Supprimer » (avec confirmation).

## 8. Photo et quota
- Vérifier qu'aucune photo stockée ne dépasse 500 Ko (recompression auto à qualité 0.75).
- `/agent/profile` affiche « Espace utilisé pour la synchro : X Mo » et alerte au-delà de 50 Mo.
