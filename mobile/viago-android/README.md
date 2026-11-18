# VIAGO C14-P1 — Android Foundation (DEV ONLY)

Ce lot crée une application Android Capacitor **isolée** dans `mobile/viago-android/`. Aucune modification d'Adresse GN/Viago Web, Django, PostgreSQL, MapLibre, routes ou données.

## Important

- **Ce n'est pas un APK livré ni un nouveau moteur GPS.** C14-P1 prépare un conteneur Android ; C14-P2 implémentera l'accès natif aux observations de localisation.
- `server.url` charge la version Web en HTTPS via le réseau privé Tailscale. Usage **développement uniquement**. Les applications publiées doivent embarquer des assets adaptés et ne pas utiliser `server.url`.
- Le téléphone doit pouvoir ouvrir le domaine HTTPS privé via Tailscale, et le PC doit conserver Next.js `3001`, Adresse GN `18000`, Viago `8001`.
- `capacitor.config.json` contient l'URL DEV et figure dans `.gitignore`. Ne jamais pousser cette configuration en production.
- Le projet Android généré reste dans `mobile/viago-android/android/` et est ignoré par Git pour ce pilote ; organiser son suivi Git plus tard.

## Après `C14_P1 = PASS`

Dans PowerShell, **sans arrêter les serveurs** :

```powershell
Set-Location 'C:\Users\Dieila\Documents\GithubGeoloc\adresse-gn\mobile\viago-android'
node --version
npm install
npx cap add android
npx cap open android
```

Prérequis : Node.js >=22, Android Studio compatible Capacitor 8 (version >=2025.2.1), SDK Android. `npm install` et `cap add android` téléchargent/génèrent des dépendances dans ce nouveau dossier et nécessitent Internet et les outils Android.

Dans Android Studio : connecter le Samsung S23 FE en mode débogage USB puis compiler et lancer l'app DEV. Aucun APK de production ne doit être distribué avec la configuration réseau privée.

## Critères de C14-P1
- Projet Capacitor créé
- Android Studio ouvre le projet
- WebView charge la page Viago privée en HTTPS via Tailscale
- Les écrans de navigation s'affichent sans casser l'app Web

## Étapes suivantes
C14-P2 : pont natif Android pour position + vitesse + bearing + précision + timestamp, avec télémétrie et mode browser inchangé. C14-P3 : capteurs inertiels et moteur de fusion.
