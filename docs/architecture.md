# Architecture

University est une plateforme de gestion universitaire (registre de présence,
scolarité, finances, campus). Elle est née du moteur de contrôle de présence
des enseignants, développé à l’origine sous le nom UniPrésence, qui en reste le
geste central : le contrôleur pointe chaque salle depuis son téléphone.

| Brique | Technologie | Dossier |
| --- | --- | --- |
| API | NestJS 11, Prisma 6, PostgreSQL ; JWT + RBAC ; i18n FR/EN (`nestjs-i18n`) | `backend/` |
| Interface | Quasar 2, Vue 3, TypeScript, Pinia, vue-i18n ; PWA installable, APK Android via Capacitor | `frontend/` |
| Passerelle biométrique | Bun, prototype avec simulateur | `biometrie/` ([doc](biometrie.md)) |
| Exploitation | Scripts de sauvegarde, restauration, preflight, APK ; vhosts nginx ; PM2 | `scripts/`, `infra/nginx/`, `ecosystem.config.cjs` ([doc](exploitation.md)) |

Le schéma Prisma (`backend/prisma/schema.prisma`) compte 65 modèles.

## Modules métier

Chaque dossier de `backend/src/modules/` est un module Nest. Ils sont regroupés
en **services** activables par l’ADMIN (Paramètres → Services de
l’établissement, module `services-actifs`). Un service désactivé perd ses liens
dans le menu et ses routes API (`ServicesActifsGuard`), sans suppression de
données. Les services obligatoires ne peuvent pas être désactivés.

| Service | Obligatoire | Modules backend |
| --- | --- | --- |
| Présence | oui | `controle`, `planification` (créneaux, séances, génération), `attestation`, `justificatifs`, `rapports` |
| Scolarité | oui | `scolarite` (évaluations, notes, délibérations), `inscription`, `portail` |
| Finances | oui | `inscription` (paiements), `paie`, `recettes` |
| Documents étudiants | oui | `documents-demande`, `attestations` |
| Réclamations, réservations | non | `reclamations`, `reservations` |
| Pilotes | non | `bibliotheque`, `cites`, `resto`, `stages`, `helpdesk`, `formations`, `patrimoine`, `courrier`, `examens`, `tirage`, `elections`, `carte-etudiante`, `badges`, `vod`, `rectorat` ; notifications SMS |

Modules transverses : `auth`, `referentiel` (comptes, années, structure,
salles, enseignants, matières, affectations), `parametres`, `imports`,
`services-actifs`.

L’état vérifié de chaque module et le travail restant sont dans
[suivi.md](suivi.md).

## Rôles

Définis par l’enum `Role` du schéma Prisma.

| Rôle | Périmètre |
| --- | --- |
| `ADMIN` | tout, y compris comptes, paramètres et services activés |
| `DIRECTION` | consultation globale, arbitrage (justificatifs, jury, paie, réservations) |
| `SCOLARITE` | référentiels, emploi du temps, inscriptions, notes, attestations |
| `CHEF_DEPARTEMENT` | son département (enseignants, contrôles, justificatifs, courrier) |
| `CONTROLEUR` | feuille de contrôle et pointage, statistiques par salle et par enseignant, guichet resto |
| `ENSEIGNANT` | **lecture seule** sur le registre : ses séances, sa fiche, ses justificatifs ; exceptions limitées (mot de passe, encadrements, tickets, vote, scan d’examen, VOD) |
| `ETUDIANT` | portail : inscription, paiements, résultats, attestations, démarches |

## Chaîne de sécurité des requêtes

Toutes les routes sont protégées par défaut. Les gardes globaux
(`backend/src/app.module.ts`) s’appliquent dans cet ordre :

1. `JwtAuthGuard` : jeton requis sauf `@Public()` ;
2. `DebitGuard` : limitation de débit par adresse réelle (`req.ip` via
   `trust proxy`), et par compte visé pour la connexion ;
3. `LectureSeuleGuard` : refuse les écritures du compte enseignant ;
4. `RolesGuard` : `@Roles(...)` ;
5. `ServicesActifsGuard` : service désactivé → route fermée ;
6. `DocumentScopeGuard` : sur les routes marquées, ressource bornée à son
   propriétaire (étudiant, enseignant ou département) ; ADMIN, DIRECTION et
   SCOLARITE en sont exemptés.

S’y ajoutent `SensitiveDataInterceptor` (retire des réponses les hachages de
mot de passe et de code, les gabarits biométriques, le NIP, le jeton resto, et
réduit les fiches enseignant ou étudiant selon le rôle) et
`PrismaExceptionFilter` (P2025/P2002 → 404/409).

## Flux principaux

**Pointage.** La scolarité saisit les créneaux hebdomadaires (conflits salle,
enseignant, promotion détectés), puis génère les séances d’une période, jours
fériés exclus. Le contrôleur ouvre sa feuille du jour, pointe chaque séance
(heure d’arrivée et de fin, effectif, thème déroulé) avec des preuves : QR de
la salle, GPS, et attestation de l’enseignant devant lui (empreinte via lecteur
externe, code personnel ou signature manuscrite). Le statut est déduit des
seuils paramétrés (`TOLERANCE_RETARD_MIN`, `ABSENCE_APRES_MIN`). Une tâche
planifiée à 1 h bascule en `NON_TENUE` les séances passées jamais contrôlées.

Paramètres de contrôle (écran Paramètres, table `Parametre`) :

| Clé | Défaut | Effet |
| --- | --- | --- |
| `TOLERANCE_RETARD_MIN` | 15 | minutes avant de considérer un retard |
| `ABSENCE_APRES_MIN` | 30 | au-delà, l’enseignant est déclaré absent |
| `QR_OBLIGATOIRE` | false | exige le scan du QR de la salle |
| `GEOLOC_OBLIGATOIRE` | false | exige une position GPS dans le rayon de la salle |
| `ATTESTATION_OBLIGATOIRE` | true | l’enseignant doit attester par l’un des trois moyens |
| `SIGNATURE_OBLIGATOIRE` | false | exige la signature manuscrite |
| `EMPREINTE_SCORE_MIN` | 60 | score minimal du lecteur d’empreintes |
| `EFFECTIF_OBLIGATOIRE` | true | exige le comptage des étudiants |
| `NOM_ETABLISSEMENT` | — | en-tête des états imprimés |

**Hors ligne.** Sans réseau, séances et pointages sont mis en file chiffrée
dans le navigateur (`stores/pointages.ts`, `stores/seances.ts`,
`services/file-chiffree.ts`), puis envoyés en lot (`POST /controles/sync`) au
retour de la connexion. Chaque élément est rejoué de façon idempotente (UUID).

**Scolarité.** Inscription (guichet ou préinscription publique), paiement,
validation ; évaluations et notes /20 ; délibération (moyenne UE pondérée par
les crédits, ADMIS / AJOURNÉ / DÉFAILLANT, rattrapage), bulletins et PV A4.

**Paiements.** Une table `Paiement` commune à cinq portefeuilles (inscriptions,
formations, resto, recettes externes, demandes de documents). Mobile Money est
simulé tant que `MOBILE_MONEY_URL` est vide : le paiement reste `EN_ATTENTE`
jusqu’à confirmation au guichet.

**Documents vérifiables.** Attestations, cartes et badges numérotés avec QR ;
la page de vérification publique est journalisée et limitée en débit.

**Paie des vacataires.** Feuilles mensuelles calculées depuis les séances
contrôlées, validées puis payées, imprimées en A4.

**Clôture d’année.** Une année clôturée verrouille les mutations rattachées
(`common/annee.ts`, `exigerAnneeOuverte`).

## Briques communes du backend (lots 1 et 2)

Ces fonctions remplacent des copies réparties dans les modules. Ce sont des
fonctions sans état, pas des providers Nest : l’appelant passe son client Prisma
ou sa transaction.

| Brique | Fichier | Rôle |
| --- | --- | --- |
| Finances | `common/finances/` | `paiement.ts` : opérateurs Mobile Money, `sourcePaiement()` (déduit le portefeuille d’un paiement depuis ses relations, avec `PAIEMENT_SOURCE_INCLUDE`), `creerPaiementTx()` (crée le paiement et sa ligne de journal dans la même transaction). `mobile-money.ts` : `transmettreMobileMoney()` appelle la passerelle **hors transaction**, puis rattache la référence opérateur ; `passerelleMobileMoneyActive()`. |
| Audit | `common/audit.ts` | `journaliser(client, user, action, entite, entiteId, details)` écrit une ligne `AuditLog` (de préférence dans la transaction `tx` de la mutation) ; `avantApres()` donne le format `{ avant, apres, ... }` lu par l’écran Journal. |
| Pagination | `common/pagination.ts` | `paginer(query)` lit `?page`, `?pageSize` (50 par défaut, borné à 1 000) et `?all=1` et rend `skip`/`take` ; `pagine(data, total, p)` rend `{ data, total, page, pageSize }`. |
| Impression | `common/impression/` | `pageA4({ titre, entete, corps, piedDePage, lang, etablissement, orientation })` produit le HTML A4 commun (palette de DESIGN.md, impression automatique) ; `chargerEtablissement()` lit une seule fois l’identité de l’établissement dans `Parametre` ; `echapper()`, `blocIndicateurs()`. Contrat : `titre` est du texte brut échappé ici, `corps` est du HTML déjà échappé par l’appelant. |
| Périmètre | `common/perimetre.ts` | `filtreDepartement(user, 'promotion.filiere')` rend le fragment `where` Prisma qui borne la lecture d’un chef de département (`{}` pour les autres rôles ; sentinelle `__aucun__` pour un chef sans département) ; `exigerPerimetre(user, departementId)` refuse l’écriture hors de son département ; `estChefDeDepartement()`. |
| Numérotation | `common/numero.ts` | `prochainNumero()` / `prochainNumeroTx()` ; `anneeNumero(libelle, borne)` — les règles d’année diffèrent selon les modules (voir [décisions en attente](suivi.md#décisions-en-attente)). |
| Autres | `common/` | `crud.service.ts` (CRUD générique), `guards.ts`, `annee.ts`, `coffre.ts` (chiffrement des gabarits), `jeton-imprimable.ts`, `sensitive-data.interceptor.ts`. |

## Organisation du frontend

Le code de `frontend/src/` est rangé par domaine, aligné sur les cinq
rubriques du menu (`navigation/manifeste.ts`) :

```
src/
├── features/
│   ├── accueil/         accueil de l’université (/, /suivi-presences, /documents), page introuvable
│   ├── presence/        rubrique Présences : contrôle, séances, emploi du temps, justificatifs, statistiques, rapports
│   ├── scolarite/       rubrique Scolarité : étudiants, inscriptions, évaluations, examens, délibérations, documents, réclamations, stages, espace étudiant
│   ├── finances/        rubrique Finances : paiements, recettes, paie
│   ├── campus/          rubrique Campus : VOD, élections, badges, cités, restauration, bibliothèque, formations, réservations, assistance, patrimoine
│   ├── administration/  rubrique Administration : organisation, plagiat, audit, rectorat, courrier, notifications, utilisateurs, paramètres
│   └── public/          écrans sans compte : connexion, portail, inscription, vérifications, bibliothèque et formations publiques
│       (chaque domaine : pages/, components/, et selon le besoin services/, types.ts)
├── shared/
│   ├── components/      briques d’interface communes (BarreFiltres, BarrePagination, EnTetePage, DialogueFormulaire…)
│   ├── composables/     useListePaginee, useConfirmation, usePresentationListe, useImpressionFicheEnseignant
│   ├── services/        http, session, impression, empreinte, file-chiffree, bibliotheque, formations
│   └── utils/           libelles/, statuts, format, csv, xlsx, titreRoute, accueil, biometrie…
├── boot/  css/  i18n/  layouts/  navigation/  router/  stores/  types/
└── App.vue
```

Règles :

- **Domaine** : un écran va dans le domaine de sa rubrique au menu. L’accueil
  commun (servi sous `/`, `/suivi-presences` et `/documents`) a son propre
  domaine `accueil` ; les écrans publics (`meta.public`) vont dans `public`.
- **Composant** : utilisé par un seul domaine, il reste dans ce domaine
  (`features/<domaine>/components/`) ; utilisé par plusieurs, il va dans
  `shared/components/`. Même règle pour les services. Les stores Pinia,
  `navigation/`, `router/`, `layouts/`, `boot/`, `css/` et `i18n/` restent à la racine.
- **Types** : `types/` garde les types partagés et `types/index.ts` réexporte
  tout (y compris `features/scolarite/types.ts`, réclamations et demandes de
  documents) : `import type { … } from '@/types'` reste la règle.
- **Imports** : `@/` désigne `src/` (déclaré dans `quasar.config.ts`, que Quasar
  recopie dans `.quasar/tsconfig.json` pour vue-tsc, et dans `vitest.config.ts`).
  On l’emploie dès qu’on sort de son domaine (ou de son dossier `shared/*`) ;
  à l’intérieur d’un domaine, les chemins relatifs courts (`../components/…`).
  Les feuilles SCSS des composants importent `@use '@/css/mixins'`.
- **Nommage** : composants en français et en PascalCase ; les pages finissent par
  `Page` (`TableauBordPage`, `AssistancePage`), les dialogues commencent par
  `Dialogue` (`DialogueEtudiant`) ; les composables commencent par `use`.
  Renommer un fichier ne change ni l’adresse ni le nom d’une route : les
  adresses (`/helpdesk`, `/synthese-presences`…) et les espaces de noms i18n
  (`helpdesk`, `dashboard`…) restent ceux d’avant.

## Briques communes du frontend (lots 1 et 2)

| Brique | Fichier | Rôle |
| --- | --- | --- |
| Accès HTTP | `shared/services/http.ts` | `lister`, `lire`, `creer`, `modifier`, `supprimer` : rendent directement le corps typé de la réponse, au-dessus de l’instance `api` de `boot/axios.ts`. Les erreurs sont notifiées une seule fois par l’intercepteur axios, sauf option `silencieux`. |
| Listes | `shared/composables/useListePaginee.ts` | état d’une liste (lignes, total, page, chargement), rechargement quand un filtre change (retour en page 1, anti-rebond de 300 ms sur les champs texte), filtres mémorisés dans l’URL (`syncUrl`), `chargerTout()` pour l’export ; helpers `pageApi()` et `texteApi()`. |
| Dialogues de saisie | `shared/components/DialogueFormulaire.vue` | coquille commune : titre, `q-form`, Annuler / Enregistrer ; `valider` n’est émis que si les règles des champs passent ; tailles s, m, l. |
| Confirmations | `shared/composables/useConfirmation.ts` | `confirmer()` (promesse booléenne), `confirmerAvecSaisie()` (motif libre), `supprimerAvecConfirmation(url, libelle, recharger)` (demande, DELETE, notification, rechargement). |
| Référentiels | `stores/referentiels.ts` | store Pinia des années, promotions, départements, enseignants, salles, matières : chargement paresseux (`?all=1`), requêtes dédoublonnées, `rafraichir()` après mutation, `vider()` à la connexion et la déconnexion (listes dépendantes du compte). |
| Autres | `shared/components/EtatVide.vue`, `EnTetePage.vue`, `BarrePagination.vue`, `BarreFiltres.vue` ; `shared/composables/usePresentationListe.ts` (tableau ou cartes selon la largeur) ; `shared/utils/libelles/` (libellés traduits, formats de date, durée, montant) ; `types/` (types découpés par domaine). |

## Internationalisation

Le frontend charge ses catalogues depuis `frontend/src/i18n/{fr-FR,en-US}` ;
la parité FR/EN se vérifie avec `cd frontend && bun run test:catalogues`. Le
backend traduit ses messages d’erreur depuis `backend/src/i18n/{fr,en}` selon
l’en-tête `Accept-Language` envoyé par l’intercepteur axios.

## Tests

| Niveau | Commande | Portée |
| --- | --- | --- |
| Unitaires backend | `cd backend && bun run test` | Jest, specs à côté du code (`*.spec.ts`) |
| Unitaires frontend | `cd frontend && bun run test:unit` | Vitest, `frontend/tests/unit/` |
| Types | `bun run typecheck` (racine) | `tsc --noEmit` backend, `vue-tsc` frontend |
| Recettes | `test:qa:*` | scénarios HTTP ou navigateur sur une API et une base QA isolées, jamais la production ([exploitation](exploitation.md#recettes-qa)) |
