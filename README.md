# University

Plateforme de gestion universitaire : registre de présence des enseignants,
scolarité LMD, finances, documents vérifiables par QR et services du campus.

Son geste central est le **pointage** : le contrôleur passe dans chaque salle
avec son téléphone et consigne la séance (heure d’arrivée, durée, effectif,
thème déroulé) avec des preuves — QR de la salle, GPS, attestation de
l’enseignant par empreinte, code ou signature — horodatées par le serveur. La
PWA fonctionne hors ligne et synchronise au retour du réseau. Autour de ce
registre : emploi du temps, justificatifs, rapports, paie des vacataires,
inscriptions et paiements, notes et délibérations, attestations, et une
vingtaine de services activables (logement, restauration, bibliothèque, VOD,
examens, courrier, élections…).

- **Backend** : NestJS 11, Prisma 6, PostgreSQL — `backend/`
- **Frontend** : Quasar 2, Vue 3, TypeScript, Pinia — PWA installable et APK Android — `frontend/`
- **Production** : <https://university.naimba.com>, API <https://university-api.naimba.com/api>

## Démarrage rapide

Prérequis : Node 24 (`.nvmrc`), bun 1.4.2, PostgreSQL.

```bash
# Base locale
sudo -u postgres psql -c "CREATE USER university WITH PASSWORD 'university_pwd';"
sudo -u postgres psql -c "CREATE DATABASE university OWNER university;"

# API — http://localhost:5031/api, Swagger sur /api/docs
cd backend
cp .env.example .env
bun install
bunx prisma migrate deploy
bunx ts-node prisma/seed.ts      # jeu de démonstration, jamais en production
bun run start:dev

# Interface — http://localhost:5029
cd frontend
bun install
bun run dev
```

Le seed crée des comptes fictifs pour les recettes locales ; ne publiez pas
leurs identifiants. Le backend de production refuse les mots de passe de
démonstration connus.

Vérifications depuis la racine (voir [l’outillage](docs/exploitation.md#outillage)) :

```bash
bun run typecheck   # tsc backend + vue-tsc frontend
bun run test        # Jest backend + Vitest frontend
bun run lint        # ESLint, avertissements seulement
```

<a id="6-déploiement"></a>

## Déploiement

Ne jamais mettre à jour la production sans avoir levé les préconditions :
sauvegarde hors serveur vérifiée, revue des migrations en attente, comptes de
démonstration remplacés. L’inspection en lecture seule
`node scripts/preflight-deploiement.cjs /tmp/university-preflight.json` les
contrôle. Procédure complète, ports, PM2, nginx, sauvegardes et variables
d’environnement : [docs/exploitation.md](docs/exploitation.md).

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/README.md](docs/README.md) | **Index de la documentation** : où chercher quoi, ce qui est vivant et ce qui est figé |
| [docs/architecture.md](docs/architecture.md) | Modules, rôles, flux principaux, briques communes du backend et du frontend |
| [docs/exploitation.md](docs/exploitation.md) | Ports, PM2, nginx, déploiement, sauvegarde et restauration, preflight, variables d’environnement, outillage |
| [docs/suivi.md](docs/suivi.md) | **Backlog vivant** : état par module, priorités, décisions en attente |
| [docs/android.md](docs/android.md) | Application Android et lecteur d’empreintes USB-OTG |
| [docs/biometrie.md](docs/biometrie.md) | Attestation par empreinte et passerelle `biometrie/` (prototype) |
| [docs/audits/](docs/audits/README.md) | Audits datés, figés, et leurs preuves |
| [docs/audits/2026-10-13-bilan-simplification.md](docs/audits/2026-10-13-bilan-simplification.md) | Bilan de la simplification des parcours |
| [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) | Contexte produit et système de design (lus par l’outil de design) |
| [infra/nginx/README.md](infra/nginx/README.md) | Vhosts nginx |
