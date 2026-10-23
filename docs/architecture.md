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

Le schéma Prisma est découpé par domaine dans `backend/prisma/schema/` :
65 modèles et 55 énumérations, répartis sur douze fichiers.

| Fichier de schéma | Contenu |
| --- | --- |
| `base.prisma` | générateur, source de données, objets SQL posés à la main |
| `identite.prisma` | comptes, rôles, paramètres, journal d’audit |
| `referentiel.prisma` | années, départements, filières, promotions, salles, enseignants, matières, affectations |
| `presence.prisma` | créneaux, séances, contrôles, justificatifs, appareils, tirages |
| `scolarite.prisma` | étudiants, inscriptions, frais, évaluations, notes, délibérations, examens, formations, stages |
| `documents.prisma` | attestations, demandes de documents, carte d’étudiant, badges |
| `finances.prisma` | paiements, frais, feuilles de paie, recettes |
| `campus.prisma` | cités, chambres, réservations, helpdesk, patrimoine, élections, réclamations |
| `recherche.prisma` | dépôt institutionnel, plagiat, ressources VOD |
| `vie-etudiante.prisma` | notifications, titre de restauration |
| `courrier.prisma` | courrier administratif, circuits de validation |
| `pilotage.prisma` | statistiques agrégées (rectorat, MESRS) |

Les migrations restent à côté, dans `backend/prisma/schema/migrations/` :
Prisma les cherche toujours dans le dossier du fichier qui porte la source de
données. `bunx prisma migrate deploy` et `bunx prisma generate` fonctionnent
donc depuis `backend/` sans argument.

## Modules métier

Les modules Nest sont rangés par domaine dans `backend/src/modules/<domaine>/`.
Un module est un dossier : `<nom>.module.ts` déclare le module,
`<nom>.controller.ts` porte les routes, `<nom>.service.ts` la logique,
`<nom>.dto.ts` les entrées validées, `<nom>.*.spec.ts` les tests.

| Domaine | Modules |
| --- | --- |
| `socle` | `auth`, `referentiel`, `parametres` |
| `presence` | `planification`, `controle`, `presence-preuves`, `justificatifs`, `tirage` |
| `scolarite` | `inscription`, `scolarite`, `examens`, `formations`, `stages`, `portail` |
| `documents` | `attestations`, `documents-demande`, `carte-etudiante`, `badges`, `courrier` |
| `finances` | `paie`, `recettes` |
| `campus` | `cites`, `resto`, `reservations`, `helpdesk`, `patrimoine`, `elections`, `bibliotheque`, `vod`, `reclamations` |
| `pilotage` | `rapports`, `rectorat`, `imports` |

Le domaine nomme le métier, pas la partie du menu : `attestation` est un
module de `documents` (les attestations de scolarité), `presence-preuves`
(appareils, code personnel, empreintes) est un module de `presence`. Les
classes de `presence-preuves` sont nommées `PresencePreuves*` ; sa route reste
`/attestation` et ses clés i18n restent celles d’avant.

Chaque module est regroupé en **services** activables par l’ADMIN (Paramètres →
Services de l’établissement, module `services-actifs`). Un service désactivé perd
ses liens dans le menu et ses routes API (`ServicesActifsGuard`), sans
suppression de données. Les services obligatoires ne peuvent pas être
désactivés.

| Service | Obligatoire | Modules backend |
| --- | --- | --- |
| Présence | oui | `controle`, `planification` (créneaux, séances, génération), `presence-preuves`, `justificatifs`, `rapports` |
| Scolarité | oui | `scolarite` (évaluations, notes, délibérations), `inscription`, `portail` |
| Finances | oui | `inscription` (paiements), `paie`, `recettes` |
| Documents étudiants | oui | `documents-demande`, `attestations` |
| Réclamations, réservations | non | `reclamations`, `reservations` |
| Pilotes | non | `bibliotheque`, `cites`, `resto`, `stages`, `helpdesk`, `formations`, `patrimoine`, `courrier`, `examens`, `tirage`, `elections`, `carte-etudiante`, `badges`, `vod`, `rectorat` ; notifications SMS |

Modules transverses : `auth`, `referentiel` (comptes, années, structure,
salles, enseignants, matières, affectations), `parametres`, `imports`,
`services-actifs`.

### Règles d’organisation du backend

- **Un module, un domaine.** Un module appartient à un seul dossier de
  domaine ; il n’y a pas de module à cheval entre deux domaines. Quand un
  module n’a pas de place évidente, on le déplace — jamais on ne duplique.
- **Nommage des fichiers.** `<nom>.controller.ts`, `<nom>.service.ts`,
  `<nom>.dto.ts`, `<nom>.module.ts` : plus de fichier « fourre-tout » qui
  rassemble plusieurs entités (le référentiel a été découpé ainsi).
- **Briques transverses.** Ce qui sert à plusieurs modules vit dans
  `backend/src/common/` (pagination, audit, périmètre, impression,
  numérotation, finances, filtres) : une fonction sans état, un appelant, pas
  un provider Nest. Un module qui n’a besoin de rien d’autre n’ajoute rien à
  `common/`.
- **Imports.** Relatifs à l’intérieur du backend (`../../common/…`,
  `../parametres/parametres.service`), jamais de chemin absolu.
- **Catalogue i18n.** Les clés restent dans `backend/src/i18n/{fr,en}` et ne
  suivent pas les déplacements de fichiers : un module renommé garde ses clés.
- **Schéma Prisma.** Un modèle et ses énumérations appartiennent au fichier de
  domaine correspondant (`backend/prisma/schema/<domaine>.prisma`) ; les
  migrations vivent à côté, dans `backend/prisma/schema/migrations/`.

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
| Numérotation | `common/numero.ts` | `SERIES_NUMERO` (table unique des séries : préfixe, module, champ, largeur, millésime) ; `prochainNumero()` / `prochainNumeroTx()` / `prochainNumeroSerie()` ; `millesimeSerie()` ; `anneeNumero(libelle, borne)`. Voir [Numérotation](#numérotation). |
| Autres | `common/` | `crud.service.ts` (CRUD générique), `guards.ts`, `annee.ts`, `coffre.ts` (chiffrement des gabarits), `jeton-imprimable.ts`, `sensitive-data.interceptor.ts`. |

## Numérotation

Les numéros sont lisibles et séquentiels : `<PRÉFIXE>-<MILLÉSIME>-<SÉQUENCE>`
(`INS-2026-00042`), le matricule d’étudiant étant `<MILLÉSIME>-<SÉQUENCE>`
(`2026-0001`). La **table unique des séries** est `SERIES_NUMERO`
(`backend/src/common/numero.ts`) : elle déclare, pour chaque préfixe, son
module, le champ qui porte la référence, la largeur de la séquence et son
millésime. Aucun module n’écrit plus son préfixe ni son année dans son code :
`SERIES_NUMERO` est la seule source de vérité.

### Règle d’année

**Le millésime d’un numéro est l’année de rattachement du document** :
l’année universitaire quand le document est rattaché à une année
universitaire, l’année civile sinon. Le choix de la moitié du libellé est une
propriété de la série, déclarée dans la table — il n’est plus décidé au cas par
cas dans les services.

| Type de série | Millésime | Exemple |
| --- | --- | --- |
| Scolarité (matricule, `INS-`, `PAY-`, `PAY-R-`) | année universitaire de **fin** (« 2025-2026 » → 2026) | `PAY-2026-00042` |
| Attestations (`ATT-`) | année universitaire de **début** (« 2025-2026 » → 2025) | `ATT-2025-00007` |
| Calendrier (`DOC-`, `PAY-D-`, `FOR-`, `PAY-F-`, `PAY-X-`, `TKT-`, `REC-`, `BADGE-`) | **année civile** d’émission | `DOC-2026-00003` |

Pourquoi ces trois déclinaisons, et non une seule année pour toutes les
séries ? Parce qu’une année unique **fusionnerait deux découpages annuels qui
coexistent déjà**, et qu’aucune des deux séries universitaires concernées ne
peut être renumérotée sans casser les références émises :

- **Scolarité.** Le matricule, le dossier d’inscription et la facture
  renvoient à l’année de rattachement de l’étudiant, pas à l’année du
  calendrier de la saisie : une inscription faite en septembre 2026 pour
  l’année 2026-2027 porte 2027. L’année civile donnerait 2026 et ferait
  cohabiter dans `INS-2026-` la fin de 2025-2026 et le début de 2026-2027 ;
  la série ne repartirait plus à 00001 en septembre.
- **Attestations.** `ATT-2026-` désigne déjà les attestations de l’année
  2026-2027 (millésime de début). Basculer sur le millésime de fin
  mélangerait, dans une même série `ATT-2026-`, deux années universitaires
  différentes : collision et ambiguïté d’origine. Le millésime de début est
  conservé.
- **Calendrier.** Une demande de document, un ticket, un badge ou une
  inscription à une formation continue ne sont pas rattachés à une année
  universitaire : l’année civile s’impose, et c’est déjà ce qui se fait.

Aucun numéro déjà émis n’est modifié, et aucune série ne change de millésime :
une nouvelle année (ou un nouveau préfixe) repart de 00001.

### Un préfixe par module

Les cinq portefeuilles de paiement partagent la table `Paiement`, dont la
colonne `reference` est **unique** (`backend/prisma/schema/finances.prisma`). Avant,
les inscriptions prenaient `PAY-<année de fin>-` et les demandes de documents
`PAY-<année civile>-`. Quand l’année de fin de l’année universitaire coïncide
avec l’année civile (janvier à août), les deux séries partagent le même
préfixe **et** le même millésime, donc le même compteur : deux écritures
concourantes se disputent le même numéro, l’une bute sur la contrainte
d’unicité, et la référence finale ne dit plus d’où elle vient.

Chaque module qui crée un paiement a donc son préfixe :

| Portefeuille | Préfixe | Millésime |
| --- | --- | --- |
| Scolarité | `PAY-` | année de fin |
| Demandes de documents | `PAY-D-` | année civile |
| Formations | `PAY-F-` | année civile |
| Restaurant | `PAY-R-` | année de fin |
| Recettes externes | `PAY-X-` | année civile |

Les paiements de documents émis avant cette décision gardent leur référence
`PAY-…` : elle reste valide, elle est seulement plus rare. La série `PAY-D-`
repart à 00001. Aucun préfixe complet n’en englobe un autre (`PAY-2026-` ne
commence pas `PAY-D-2026-`), et chaque préfixe appartient à un seul module.

### Lecture du plus grand numéro

`prochainNumero()` ne charge plus toutes les lignes du préfixe : elle lit **une
seule** ligne, la plus grande (`orderBy` décroissant + `take: 1`), bornée à la
plage de largeur de la séquence (`gte` / `lte`). L’ordre lexicographique de la
colonne est l’ordre numérique parce que la séquence est à zéros initiaux de
largeur fixe ; la requête reste un parcours d’index sur la colonne unique.

- Les références qui ne suivent pas le format attendu (saisie manuelle,
  ancienne numérotation) sont ignorées. Si la ligne lue n’est pas une
  référence de la série, la lecture est élargie à un lot limité (32 lignes)
  pour ne pas bloquer la série ni repartir de zéro.
- La protection contre les écritures concurrentes est inchangée : la création
  se fait dans une transaction, et l’échec de la contrainte d’unicité
  (`P2002`) relance la génération du numéro.

Limite connue : au-delà de 99 999 numéros par série et par millésime, la
séquence déborde la largeur fixe ; le correctif durable est une séquence SQL
par préfixe, encore au [backlog](suivi.md#outillage-et-code).

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
