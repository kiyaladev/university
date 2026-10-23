# Décision d'architecture — harmonisation des statuts (enums Prisma)

- **Statut** : proposée, prête à revue — **jamais appliquée en production depuis cette branche**
- **Date** : 2026-10-23
- **Périmètre** : `backend/prisma/schema/`, le code applicatif, les catalogues i18n, les
  scripts de recette, le seed et la documentation.
- **Branche** : `mc/statuts` (worktree dédié, non fusionnée dans `development`).

---

## 1. Contexte

Les valeurs d'état stockées en base sont, pour un même fait, orthographiées de plusieurs façons :
`ANNULE` (paiement) et `ANNULEE` (séance) ; `VALIDE` (justificatif) et `VALIDEE` (inscription) ;
`CLOTURE` (ticket) et `CLOTUREE` (évaluation) ; `REJETE` / `REJETEE` ; `RESOLU` / `RESOLUE` ;
`CONFIRME` / `CONFIRMEE`.

Conséquences observées :

- une même notion n'a pas un nom unique → le code doit connaître l'enum pour connaître le mot ;
- les libellés français ne suivent pas les jetons (`statut_paiement.ECHOUE` vaut « Échoué » dans
  un écran et « Échouée » dans un autre ; `statut_suspicion.ACQUITTE` vaut « Acquittée ») ;
- les phrases d'i18n qui interpolent le jeton brut (`{election.statut}`) sont grammaticalement
  fragiles ;
- le code hors ligne (fichier de pointages/séances dans le navigateur) peut contenir des jetons
  qui n'existent plus après migration.

Objectif : **un seul jeton par état, une règle applicable sans arbitrage, une migration qui ne
réécrit aucune table.**

## 2. Inventaire

Les 52 enums du schéma, avec leurs champs. `Statut*` = état d'un acte ; `Type*` = nature ;
`Priorite*`, `Niveau`, `Mode*` = graduation ou modality.

| Enum | Valeurs | Champs |
|---|---|---|
| `Role` | ADMIN, DIRECTION, SCOLARITE, CHEF_DEPARTEMENT, CONTROLEUR, ENSEIGNANT, ETUDIANT | `User.role` |
| `StatutEnseignant` | PERMANENT, VACATAIRE, CONTRACTUEL | `Enseignant.statut` |
| `TypeCours` | CM, TD, TP, EXAMEN, CONFERENCE | `Creneau.type`, `Seance.type` |
| `StatutSeance` | PLANIFIEE, EN_COURS, CONTROLEE, ANNULEE, NON_TENUE | `Seance.statut` |
| `StatutPresence` | PRESENT, RETARD, ABSENT, DEPART_ANTICIPE, REMPLACE, EXCUSE | `Controle.statut` |
| `MethodeVerification` | MANUEL, QR_SALLE, GEOLOCALISATION, SIGNATURE | `Controle.methode` |
| `AttestationMode` | AUCUNE, SIGNATURE, CODE_PIN, EMPREINTE | `Controle.attestation` |
| `TypeJustificatif` | MALADIE, MISSION, FORMATION, DEUIL, TRANSPORT, AUTRE | `Justificatif.type` |
| `StatutJustificatif` | EN_ATTENTE, VALIDE, REJETE | `Justificatif.statut` |
| `Niveau` | L1…DOCTORAT | `Promotion.niveau` |
| `StatutInscription` | BROUILLON, EN_ATTENTE_PAIEMENT, PAYEE, VALIDEE, ANNULEE | `Inscription.statut` |
| `StatutPaiement` | EN_ATTENTE, REUSSI, ECHOUE, ANNULE, REMBOURSE | `Paiement.statut`, `Recharge.statut` |
| `ModePaiement` | MOBILE_MONEY, ESPECES, VIREMENT | `Paiement.mode` |
| `StatutPaie` | BROUILLON, VALIDEE, PAYEE | `FeuillePaie.statut` |
| `TypeEvaluation` | CC, EXAMEN, RATTRAPAGE, ORAL, TP | `Evaluation.type` |
| `StatutEvaluation` | OUVERTE, CLOTUREE | `Evaluation.statut` |
| `SessionDeliberation` | NORMALE, RATTRAPAGE | `Deliberation.session` |
| `StatutDeliberation` | BROUILLON, VALIDEE | `Deliberation.statut` |
| `DecisionJury` | ADMIS, AJOURNE, DEFAILLANT | `DeliberationLigne.decision` |
| `TypeAttestation` | SCOLARITE, SITUATION, REUSSITE, DIPLOME, ASSIDUITE | `Attestation.type` |
| `StatutAttestation` | EMISE, REVOQUEE | `Attestation.statut`, `CarteEtudiante.statut` |
| `StatutNotification` | EN_ATTENTE, ENVOYEE, ECHOUE | `Notification.statut` |
| `CategorieChambre` | CHAMBRE_SIMPLE, CHAMBRE_PARTAGEE, STUDIO, APPARTEMENT | `Chambre.categorie` |
| `StatutChambre` | LIBRE, RESERVEE, OCCUPEE, MAINTENANCE | `Chambre.statut` |
| `StatutAttributionLogement` | EN_ATTENTE, ACCORDEE, REFUSEE, RETIREE | `AttributionLogement.statut` |
| `TypeDocument` | MEMOIRE, THESE, ARTICLE, RAPPORT, SUPPORT_COURS, ARCHIVE, AUTRE | `DocumentDepot.type` |
| `TypeRepas` | PETIT_DEJEUNER, DEJEUNER, COLLATION, DINER, AUTRE | `ConsommationResto.repas` |
| `StatutConsommation` | EN_ATTENTE, VALIDEE, ANNULEE | `ConsommationResto.statut` |
| `StatutReservationSalle` | EN_ATTENTE, CONFIRMEE, REFUSEE, ANNULEE | `ReservationSalle.statut` |
| `TypeEncadrement` | STAGE, MEMOIRE, RAPPORT | `TravailEncadre.type` |
| `StatutEncadrement` | PROPOSE, VALIDE, EN_COURS, SOUTENU, ABANDONNE | `TravailEncadre.statut` |
| `CategorieIncident` | VIDEO, SON, RESEAU, ELECTRICITE, MOBILIER, INFORMATIQUE, CLIMATISATION, AUTRE | `TicketSupport.categorie` |
| `PrioriteTicket` | BASSE, NORMALE, HAUTE | `TicketSupport.priorite` |
| `StatutTicket` | OUVERT, EN_COURS, RESOLU, CLOTURE | `TicketSupport.statut` |
| `StatutFormation` | BROUILLON, PUBLIEE, COMPLETE | `Formation.statut` |
| `StatutInscriptionFormation` | EN_ATTENTE, CONFIRMEE, ANNULEE | `InscriptionFormation.statut` |
| `StatutSuspicionPlagiat` | EN_ATTENTE, ACQUITTE, CONFIRME | `SuspicionPlagiat.statut` |
| `StatutReparation` | DECLARE, EN_COURS, TERMINE, ANNULE | `ReparationMateriel.statut` |
| `TypeCourrier` | ENTRANT, SORTANT | `Courrier.type` |
| `StatutCourrier` | RECU, ENREGISTRE, EN_CIRCUIT, TRAITE, CLASSE, ARCHIVE | `Courrier.statut`, `CircuitCourrier.statut` |
| `TypeExamen` | PARTIEL, FINAL, RATTRAPAGE, CONTROLE_CONTINU | `Examen.type` |
| `StatutExamen` | PLANIFIE, EN_COURS, TERMINE, ANNULE | `Examen.statut` |
| `StadeTirage` | PROGRAMME, IMPRIME, MIS_SOUS_PLI, DISTRIBUE, RECUPERE, ANNULE | `Tirage.stade` |
| `TypeRecette` | ANALYSE_LABO, LOCATION_AMPHI, PRESTATION_FORMATION, PRESTATION_CONSEIL, AUTRE | `RecetteExterne.type` |
| `TypeReclamation` | NOTE_MANQUANTE, ERREUR_SAISIE, INSCRIPTION, ENSEIGNEMENT, SCOLARITE, TECHNIQUE, AUTRE | `Reclamation.type` |
| `PrioriteReclamation` | BASSE, NORMALE, HAUTE, URGENTE | `Reclamation.priorite` |
| `StatutReclamation` | OUVERTE, EN_COURS, EN_ATTENTE_REPONSE, RESOLUE, FERMEE, REJETEE | `Reclamation.statut` |
| `TypeDemandeDocument` | ATTESTATION_SCOLARITE, ATTESTATION_FREQUENTATION, RELEVE_NOTES, DUPLICATA_CARTE, ATTESTATION_REUSSITE, CERTIFICAT_SCOLARITE, AUTRE | `DemandeDocument.type`, `TarifDemande.type` |
| `StatutDemande` | EN_ATTENTE_PAIEMENT, PAYEE, EN_TRAITEMENT, PRETE, REMISE, REJETEE | `DemandeDocument.statut` |
| `TypeElection` | DELEGUE_PROMOTION, DELEGUE_DEPARTEMENT, PRESIDENT_UNIVERSITE, SYNDICAT, CLUB | `Election.type` |
| `StatutElection` | BROUILLON, OUVERTE, CLOSE, PROCLAMEE, ANNULEE | `Election.statut` |
| `ModeVote` | WEB, KIOSQUE, SMS | `VoteElection.mode` |
| `StatutBadge` | ACTIF, EXPIRE, ANNULE | `BadgeAcces.statut` |
| `TypeRessourceVOD` | AUDIO, VIDEO, NOTES, TRANSCRIPTION | `CoursVOD.type` |
| `StatutVOD` | BROUILLON, EN_LIGNE, HORS_LIGNE, ARCHIVE | `CoursVOD.statut` |

`StatutCarteEtudiante` (`EMISE`, `REVOQUEE`) n'existe que côté front : il duplique
`StatutAttestation` et suit les mêmes renommages.

## 3. Convention retenue

> **Les valeurs d'état (`Statut*`) sont écrites sans marqueur de genre : forme masculine
> singulière non accentuée (`ANNULE`, `VALIDE`, `CLOTURE`, `EMIS`…).**
>
> Les valeurs de nature (`Type*`), de graduation (`Priorite*`, `Niveau`, `Mode*`) ne sont pas
> concernées : leur genre est celui de leur nom commun (« une priorité basse », « un niveau
> L1 »), pas celui d'un état.

Autrement dit : **un état, un jeton, quelle que soit l'entité qui le porte.** `ANNULE`
signifie « annulé » partout, `VALIDE` signifie « validé » partout.

### Pourquoi cette règle

1. **Elle est mécanique.** Il n'y a pas d'exception à décider par enum : on prend la forme
   masculine du participe ou de l'adjectif. Aucune connaissance de l'entité n'est requise,
   ce qui compte pour les enums transverses (`StatutPresence`, `StatutNotification`) ou
   rattribuables à plusieurs entités (`StatutAttestation` → `Attestation` *et*
   `CarteEtudiante`).
2. **Elle donne un jeton unique par état.** C'est le but : `ANNULE` et `ANNULEE` ne coexistent
   plus, donc plus rien en dépend, plus aucun `if (statut === 'ANNULEE')` à maintenir dans
   deux orthographes selon l'écran.
3. **Elle va dans le sens de l'existant.** La majorité des jetons sont déjà dans cette forme
   (`VALIDE`, `REJETE`, `RESOLU`, `CLOTURE`, `TERMINE`, `ANNULE`, `PLANIFIE`, `SOUTENU`,
   `ACQUITTE`, `CONFIRME`…). L'harmonisation supprime la minorité, pas l'inverse.
4. **Elle est indépendante de la base.** Les valeurs sont déjà stockées en ASCII majuscule
   non accentué : aucune migration de données n'est nécessaire, seulement un renommage de
   valeur d'enum.
5. **Elle reste lisible.** Le libellé affiché est aligné sur le jeton (« Annulé », « Validé »,
   « Clôturé ») : c'est la forme que l'on lit seule dans une pastille d'état.

### Alternatives écartées

| Alternative | Pourquoi elle est écartée |
|---|---|
| Accord au genre de l'entité (`ANNULEE` pour une demande, `ANNULE` pour un ticket) | C'est la convention actuelle de fait : elle n'harmonise rien (le même état garde deux jetons), exige de connaître le genre de l'entité pour chaque enum et échoue sur les enums transverses. C'est aussi la seule option qui rende les phrases d'i18n grammaticales quand elles interpolent le jeton brut — d'où les 5 phrases backend reformulées (cf. §6). |
| Accord au féminin partout | Impossibles à tenir : « un ticket résolu » deviendrait « résolue », « un examen annulé » deviendrait « annulée ». Le genre de l'entité est réel, on ne peut pas le nier par convention. |
| Formes invariables (sans participe) : `ANNULATION`, `VALIDATION` | Refusée : elle transforme des *états* en *actions*, ce qui casse la lecture des tableaux et des filtres (une liste de statuts n'est pas une liste d'actions). Coût de réécriture très supérieur, sans gain sur l'ambiguïté constatée. |

### Règle de libellé

Le jeton et le libellé FR suivent la même règle, **sauf** quand le libellé ne nomme pas
l'état mais décrit une entité ou une action :

| Cas | Exemple | Traitement |
|---|---|---|
| Libellé d'état (namespace `libelles.*`, pastilles, étapes) | `ANNULE` → « Annulé », `PRET` → « Prêt », `OUVERT` → « Ouvert » | non genré : il reprend le jeton |
| Reformulation qui décrit une entité genrée | « Frais payés », « Absence excusée », « Non tenue », « Marquer prête », « {n} réservées » | inchangé : le genre est celui de l'entité |
| Phrase qui interpole le jeton brut | « L'état de l'élection est {statut} » | reformulée : le jeton doit occuper une place syntaxique neutre (« l'état », « le statut ») |

Les libellés anglais ne sont pas concernés : ils n'ont pas de genre. Seules leurs **clés**
suivent le jeton.

### Ce que la règle ne change pas

- `NON_TENUE` (locution invariable : « séance non tenue ») est conservée.
- `REMISE` (nom : « la remise du dossier ») est conservée.
- `EN_ATTENTE`, `EN_COURS`, `EN_CIRCUIT`, `EN_TRAITEMENT`, `MAINTENANCE`, `ARCHIVE`,
  `BROUILLON` sont déjà sans genre.
- Les priorités (`BASSE`, `NORMALE`, `HAUTE`, `URGENTE`) sont conservées : « une priorité
  basse ».

## 4. Renommages

24 valeurs, **39 renommages** répartis sur 16 enums Prisma (`Statut*` sauf mention contraire).
S'y ajoutent, hors Prisma : `StatutCarteEtudiante` (type front qui duplique `StatutAttestation`)
et le pseudo-statut de recette `ENCAISSEE` → `ENCAISSE` (état calculé côté front, jamais stocké).

| Enum | Ancienne valeur | Nouvelle valeur | Entités / champs concernés | Impact |
|---|---|---|---|---|
| `StatutSeance` | `ANNULEE` | `ANNULE` | `Seance.statut` | B, F, I, R, S, D |
| `StatutSeance` | `PLANIFIEE` | `PLANIFIE` | `Seance.statut` | B, F, I, R, S, D |
| `StatutSeance` | `CONTROLEE` | `CONTROLE` | `Seance.statut` | B, F, I, R, S, D |
| `StatutInscription` | `ANNULEE` | `ANNULE` | `Inscription.statut` | B, F, I, R, S, D |
| `StatutInscription` | `VALIDEE` | `VALIDE` | `Inscription.statut` | B, F, I, R, S, D |
| `StatutInscription` | `PAYEE` | `PAYE` | `Inscription.statut` | B, F, I, R, S, D |
| `StatutPaie` | `VALIDEE` | `VALIDE` | `FeuillePaie.statut` | B, F, I, R, S, D |
| `StatutPaie` | `PAYEE` | `PAYE` | `FeuillePaie.statut` | B, F, I, R, S, D |
| `StatutEvaluation` | `OUVERTE` | `OUVERT` | `Evaluation.statut` | B, F, I, R, S, D |
| `StatutEvaluation` | `CLOTUREE` | `CLOTURE` | `Evaluation.statut` | B, F, I, R, S, D |
| `StatutDeliberation` | `VALIDEE` | `VALIDE` | `Deliberation.statut` | B, F, I, R, S, D |
| `StatutAttestation` | `EMISE` | `EMIS` | `Attestation.statut`, `CarteEtudiante.statut` | B, F, I, R, S, D |
| `StatutAttestation` | `REVOQUEE` | `REVOQUE` | `Attestation.statut`, `CarteEtudiante.statut` | B, F, I, R, S, D |
| `StatutNotification` | `ENVOYEE` | `ENVOYE` | `Notification.statut` | B, F, I, R, S, D |
| `StatutChambre` | `RESERVEE` | `RESERVE` | `Chambre.statut` | B, F, I, R, S, D |
| `StatutChambre` | `OCCUPEE` | `OCCUPE` | `Chambre.statut` | B, F, I, R, S, D |
| `StatutAttributionLogement` | `ACCORDEE` | `ACCORDE` | `AttributionLogement.statut` | B, F, I, R, S, D |
| `StatutAttributionLogement` | `REFUSEE` | `REFUSE` | `AttributionLogement.statut` | B, F, I, R, S, D |
| `StatutAttributionLogement` | `RETIREE` | `RETIRE` | `AttributionLogement.statut` | B, F, I, R, S, D |
| `StatutConsommation` | `VALIDEE` | `VALIDE` | `ConsommationResto.statut` | B, F, I, R, S, D |
| `StatutConsommation` | `ANNULEE` | `ANNULE` | `ConsommationResto.statut` | B, F, I, R, S, D |
| `StatutReservationSalle` | `CONFIRMEE` | `CONFIRME` | `ReservationSalle.statut` | B, F, I, R, S, D |
| `StatutReservationSalle` | `REFUSEE` | `REFUSE` | `ReservationSalle.statut` | B, F, I, R, S, D |
| `StatutReservationSalle` | `ANNULEE` | `ANNULE` | `ReservationSalle.statut` | B, F, I, R, S, D |
| `StatutFormation` | `PUBLIEE` | `PUBLIE` | `Formation.statut` | B, F, I, R, S, D |
| `StatutFormation` | `COMPLETE` | `COMPLET` | `Formation.statut` | B, F, I, R, S, D |
| `StatutInscriptionFormation` | `CONFIRMEE` | `CONFIRME` | `InscriptionFormation.statut` | B, F, I, R, S, D |
| `StatutInscriptionFormation` | `ANNULEE` | `ANNULE` | `InscriptionFormation.statut` | B, F, I, R, S, D |
| `StatutReclamation` | `OUVERTE` | `OUVERT` | `Reclamation.statut` | B, F, I, R, S, D |
| `StatutReclamation` | `RESOLUE` | `RESOLU` | `Reclamation.statut` | B, F, I, R, S, D |
| `StatutReclamation` | `FERMEE` | `FERME` | `Reclamation.statut` | B, F, I, R, S, D |
| `StatutReclamation` | `REJETEE` | `REJETE` | `Reclamation.statut` | B, F, I, R, S, D |
| `StatutDemande` | `PAYEE` | `PAYE` | `DemandeDocument.statut` | B, F, I, R, S, D |
| `StatutDemande` | `PRETE` | `PRET` | `DemandeDocument.statut` | B, F, I, R, S, D |
| `StatutDemande` | `REJETEE` | `REJETE` | `DemandeDocument.statut` | B, F, I, R, S, D |
| `StatutElection` | `OUVERTE` | `OUVERT` | `Election.statut` | B, F, I, R, S, D |
| `StatutElection` | `CLOSE` | `CLOS` | `Election.statut` | B, F, I, R, S, D |
| `StatutElection` | `PROCLAMEE` | `PROCLAME` | `Election.statut` | B, F, I, R, S, D |
| `StatutElection` | `ANNULEE` | `ANNULE` | `Election.statut` | B, F, I, R, S, D |
| `StatutCarteEtudiante` (front) | `EMISE` | `EMIS` | `CarteEtudiante.statut` | F, I |
| `StatutCarteEtudiante` (front) | `REVOQUEE` | `REVOQUE` | `CarteEtudiante.statut` | F, I |
| pseudo-statut de recette (front) | `ENCAISSEE` | `ENCAISSE` | `RecettesPage` (état calculé) | F, I |

Légende des impacts : **B** backend (`backend/src`, DTO, services, tests) — **F** frontend
(`frontend/src`, types, pages, tests) — **I** i18n (`frontend/src/i18n/fr-FR`,
`frontend/src/i18n/en-US`, `backend/src/i18n/{fr,en}`) — **R** recettes
(`backend/scripts/recette-*.cjs`) — **S** seed (`backend/prisma/seed.ts`) — **D** documentation.

### Détail par domaine

- **Backend** : 44 occurrences dans `backend/prisma/schema/`, 43 dans `seed.ts`, ~250 dans
  `backend/src` (services, DTO, tests). Les comparaisons directes (`statut === 'VALIDEE'`),
  les `@IsEnum(...)` et les `switch` sont mis à jour ; les libellés français des services
  (`LIBELLE_STATUT_INSCRIPTION`, etc.) sont alignés sur le nouveau jeton.
- **Frontend** : `frontend/src/types/*` (types miroirs du schéma), `frontend/src/shared/utils/statuts.ts`
  (tables de tons, contraintes `satisfies Record<StatutX, Ton>` qui **vérifient** la
  correspondance avec Prisma), `frontend/src/shared/utils/libelles/*.ts` (libellés de repli
  français), les pages et composants qui filtrent sur un statut, `frontend/tests`.
- **i18n** : les **clés** suivent le jeton (`ANNULEE:` → `ANNULE:`) dans les deux langues ; les
  **valeurs françaises** passent au masculin (« Annulée » → « Annulé ») ; les valeurs anglaises
  sont inchangées (« Cancelled »). Cinq messages backend qui interpolaient le jeton brut sont
  reformulés pour rester grammaticaux (§6).
- **Recettes** : `backend/scripts/recette-*.cjs` (14 scripts) vérifient des statuts en dur.
- **Seed** : `backend/prisma/seed.ts` alimente les statuts en dur.
- **Docs** : ce document ; les rapports d'audit déjà écrits (`docs/audits/`, preuves brutes
  comprises dans `docs/audits/preuves/`) sont des **archives** : ils décrivent l'état du code à
  la date de leur rédaction et ne sont pas réécrits.
- **Scripts de recette front** : `frontend/tests/*.mjs` (QA Playwright pilotant une API réelle)
  containaient eux aussi des statuts en dur : ils sont à jour.

### Deux effets de bord révélés par l'harmonisation

**1. Une collision de jeton entre la délibération et l'encadrement.**
`StatutDeliberation.VALIDEE` devient `VALIDE`, et le front fusionnait déjà le namespace
`statut_deliberation` avec les statuts d'encadrement (`PROPOSE`, `VALIDE`, `SOUTENU`,
`ABANDONNE`) : les deux `VALIDE` tombaient dans le même objet et le typage le signalait
(`TS1117`). Le domaine `deliberation` garde une seule entrée `VALIDE` (ton `positif`, dans les
deux cas) ; la nuance « lecture seule » de l'encadrement reste portée par le namespace
`statut_encadrement`, qui a sa propre entrée.

**2. Le journal d'audit n'est pas un catalogue de statuts : son vocabulaire est conservé.**
Le journal est une trace persistée, lue par les rapports sur des périodes qui couvrent la
migration. Trois services construisaient leur action à partir du statut
(`RECLAMATION_${statut}`, `RESERVATION_${statut}`, `ATTRIBUTION_${statut}`) et les élections
écrivaient le détail « transition » (`BROUILLON→OUVERTE`). Renommer ces chaînes aurait coupé
le journal en deux vocabulaires, sans réécriture possible de l'historique. Elles conservent
donc l'écriture historique, via des tables explicites et typées dans chaque service
(`ACTION_STATUT`, `TRANSITION_STATUT`) : `RECLAMATION_RESOLU` est journalisé
`RECLAMATION_RESOLUE`, comme avant la migration.

Conséquence : **les noms d'actions du journal (`RECLAMATION_RESOLUE`, `RESERVATION_REFUSEE`,
`ELECTION_OUVERTE`…) ne suivent pas la convention** — ce sont des événements, pas des états.
Les noms d'événements qui contiennent un mot d'état sont, par construction, hors du périmètre
de la convention.

## 5. Hors périmètre — fusions proposées, non appliquées

Aucune fusion d'enums n'est appliquée ici : les enums concernés portent des valeurs
différentes ou des règles de gestion distinctes. Deux pistes sont documentées pour arbitrage
ulérieur.

### 5.1 `PrioriteTicket` ⊂ `PrioriteReclamation`

`PrioriteTicket` = { BASSE, NORMALE, HAUTE } est un sous-ensemble strict de
`PrioriteReclamation` = { BASSE, NORMALE, HAUTE, URGENTE }. Les noms de valeurs sont
identiques : fusionner serait techniquement possible.

- **Proposition** : remplacer `TicketSupport.priorite` par `PrioriteReclamation`, en
  interdisant `URGENTE` pour un ticket (contrainte applicative) ou en l'acceptant si le
  support doit monter en urgence.
- **Risques** : (a) élargissement du domaine de valeurs d'un ticket — un ticket pourrait
  recevoir `URGENTE`, ce qui change le comportement des files de traitement ; (b) impact
  sur les filtres et les tris côté front (`TONS_STATUT` distingue les deux domaines) ; (c)
  impact sur les requêtes d'agrégation et les index ; (d) les recipes et les données
  existantes doivent rester valides.
- **Décision** : **proposé, non appliqué.** À arbitrer avec le métier (le support a-t-il un
  niveau « urgente » ?).

### 5.2 `TypeEvaluation` et `TypeExamen`

- `TypeEvaluation` = { CC, EXAMEN, RATTRAPAGE, ORAL, TP } : nature de l'épreuve *notée*
  d'un module.
- `TypeExamen` = { PARTIEL, FINAL, RATTRAPAGE, CONTROLE_CONTINU } : nature d'une *session
  d'examen* planifiée (plan de passage).

Ils ne se recoupent que sur `RATTRAPAGE`, avec des sens différents (rattrapage d'un module,
session de rattrapage). `TypeCours.EXAMEN` et `TypeEvaluation.EXAMEN` sont un troisième
recoupement de même nature.

- **Proposition** : introduire un `TypeNatureEvaluation` commun (CM, TD, TP, EXAMEN, ORAL,
  RATTRAPAGE) et faire de `TypeExamen` une contrainte de session
  (PARTIEL, FINAL, SESSION_RATTRAPAGE, CONTROLE_CONTINU) ; à défaut, documenter les deux
  notions dans `DESIGN.md` et garder les enums séparés.
- **Risques** : fusion à l'aveugle perdrait la distinction module/session (une session
  « finale » peut porter un CC et un TP) ; refonte du front (filtres, libellés, formulaires de
  création d'évaluation et de session) et du backend (DTO, unicité, plan de passage).
- **Décision** : **proposé, non appliqué.**

## 6. Compatibilité

Trois surfaces échangent des jetons d'état avec l'extérieur. Chacune est traitée.

| Surface | Traitement |
|---|---|
| **Requêtes entrantes (API)** | Le backend accepte les **anciens et les nouveaux** jetons : une valeur reçue qui figure dans la table de compatibilité est convertie avant validation (`@IsEnum`) et avant écriture. Un client ancien (navigateur qui n'a pas rechargé le JS) continue de fonctionner. |
| **Réponses (API → navigateur)** | Le frontend normalise les réponses : un jeton ancien reçu de l'API est converti en jeton courant. L'interface fonctionne donc aussi bien derrière un backend ancien (déploiement partially applied, retour arrière). |
| **Stockage local (hors ligne)** | Les fichiers conservés sur l'appareil (file des pointages, file des séances, cache de tournée) sont relus au démarrage : les jetons anciens y sont convertis et le fichier est réécrit (migration de la file). |
| **Base** | `ALTER TYPE … RENAME VALUE` conserve les données : aucune ligne n'est réécrite, aucune table n'est recopiée. |

La table de compatibilité est une bijection `ancien → nouveau` (25 entrées : les 24 jetons
Prisma, plus le pseudo-statut de recette `ENCAISSEE`, qui n'existe que côté front) ; elle est
écrite à un seul endroit par domaine (`backend/src/common/statuts.ts`,
`frontend/src/shared/utils/statuts.ts`) et couverte par des tests des deux côtés.

**Ce que contient réellement le stockage local (vérifié).** Les seuls statuts écrits par le
navigateur sont ceux de la présence (`PRESENT`, `RETARD`, `ABSENT`…), qui ne sont pas renommés ;
la séance mise en file est envoyée sans statut (le serveur lui attribue `PLANIFIE`) ; le cache
de tournée ne porte que des affectations et des salles, sans statut. **Aucun jeton renommé
n'est donc stocké sur l'appareil aujourd'hui.** La normalisation à la lecture est conservée
malgré tout : elle est le filet de sécurité si une fonctionnalité hors ligne vient à porter un
statut, et elle couvre le cas d'un fichier écrit par une version antérieure du front.

### Phrases d'i18n qui interpolaient le jeton brut

Quatre messages backend interpolaient le jeton dans une phrase française ; la forme non genrée
y serait agrammaticale (« L'élection est OUVERT »). Ils sont reformulés pour que le jeton
occupe une place syntaxique neutre, et **leur clé change** (la clé est le slug du message
français) :

| Avant | Après |
|---|---|
| « L'élection est {election.statut} : seule une OUVERTE peut être close. » | « L'état de l'élection est {election.statut} : elle ne peut être close que depuis l'état ouvert. » |
| « L'élection est {election.statut} : seule une CLOSE peut être proclamée. » | « L'état de l'élection est {election.statut} : elle ne peut être proclamée que depuis l'état clos. » |
| « Cette chambre ne peut pas passer en OCCUPE : … » | « Cette chambre ne peut pas prendre le statut OCCUPE : … » |
| « Une chambre ne peut pas être créée OCCUPE : … » | « Une chambre ne peut pas être créée au statut OCCUPE : … » |

Les quatre appels (`cites.service.ts`, `elections.service.ts`) sont mis à jour en conséquence.
Les autres messages qui interpolent un statut ne sont pas concernés : ils le placent entre
guillemets ou dans une parenthèse (« {consommation.statut} », « (statut : {statut}) »), où la
forme non genrée se lit correctement.

## 7. Procédure de déploiement

> **Rappel** : cette branche n'est pas déployée. La procédure ci-dessous est écrite pour la
> branche de déploiement ; aucune base de production n'a été touchée.

### Ordre retenu : **migration d'abord, puis backend, puis frontend**

Justification : `ALTER TYPE … RENAME VALUE` renomme la valeur *en place*. La base ne peut donc
pas contenir les deux écritures à la fois. Deux états sont possibles, et un seul ordre évite
qu'une application tourne avec des jetons que la base ne connaît plus :

- **migration d'abord** : pendant la fenêtre entre la migration et le déploiement du backend,
  l'ancien code écrit encore `ANNULEE` → Postgres refuse la valeur (`invalid input value for
  enum`) ; l'ancien code lit `ANNULE` et ne reconnaît plus ses propres statuts
  (`statut === 'ANNULEE'` devient faux) → les filtres et les transitions silencieusement
  inopérants. **La fenêtre doit donc être une coupure des écritures**, pas une coexistence.
- **code d'abord** : le nouveau code écrit `ANNULE` dans une base qui ne contient encore que
  `ANNULEE` → refus immédiat, plus une désynchronisation entre le code et le schéma Prisma
  (le client généré ne correspond plus à la base).

D'où la séquence, avec une coupure courte et annoncée des écritures :

1. **J-1** — gel des changements de schéma ; revue de la migration ; sauvegarde
   (`scripts/backup-db.sh`).
2. **J0, T0** — mise en lecture seule de l'application (bandeau « maintenance »), arrêt des
   travaux de fond qui écrivent (`pm2 stop` des workers de rapport et de notification).
3. **T0 + 1 min** — application de la migration :
   `cd backend && npx prisma migrate deploy` (ou `prisma migrate dev` en recette).
   `ALTER TYPE … RENAME VALUE` est une opération de catalogue : quelques millisecondes, aucun
   `COPY`, aucun `REWRITE`, pas de réécriture de table.
4. **T0 + 3 min** — déploiement du **backend** (code compatible : il accepte les anciens et
   les nouveaux jetons en entrée, cf. §6). Les navigateurs qui n'ont pas rechargé le
   front continuent d'écrire d'anciens jetons : ils sont convertis.
5. **T0 + 5 min** — déploiement du **frontend** (il parle les nouveaux jetons et normalise les
   réponses).
6. **T0 + 10 min** — remise en écriture, contrôle des journaux applicatifs (chercher
   `invalid input value for enum` et les 4xx suspects), purge des anciens bundles dans les
   proxys/CDN si le front est servi en cache.
7. **J+7** — retrait du mapping de compatibilité (backend) une fois qu'aucun client ancien
   n'est actif (à confirmer par les journaux et le taux d'échec de synchronisation hors ligne).

### Pourquoi l'ancien code tourne-t-il pendant la migration ?

Il ne doit pas y écrire. Le point important est que **la migration est un renommage, pas une
réécriture** : elle est instantanée et ne peut pas être faite « à moitié ». L'ancien code peut
continuer à **lire** pendant la préparation de la migration (il lit encore `ANNULEE`, la base
contient encore `ANNULEE`) ; il doit être arrêté **avant** le `RENAME VALUE`. C'est pourquoi la
procédure impose la coupure des écritures en étape 2 : l'ancien code tourne en lecture seule
pendant la migration, ce qui évite un arrêt de service visible, et il est remplacé avant que
quiconque n'écrive.

### Retour arrière

Le retour arrière n'est **pas** un simple redéploiement de l'ancien code : la base porte les
nouveaux jetons.

1. Arrêter les écritures (même coupure courte).
2. Rejouer la migration inverse : `ALTER TYPE … RENAME VALUE 'ANNULE' TO 'ANNULEE'` (et les 23
   autres), ou `prisma migrate resolve --rolled-back` suivi du SQL inverse — la migration est
   écrite pour être réversible ligne à ligne.
3. Redéployer l'ancien backend, puis l'ancien frontend.
4. Rouvrir les écritures.

Le mapping de compatibilité du backend (étape 4 du déploiement) rend le retour arrière
possible **même sans** inverser la base : l'ancien frontend envoie `ANNULEE`, le backend
nouveau le convertit. En revanche l'ancien *backend* deployed sur une base déjà renommée
n'est plus viable : c'est le sens de la coupure.

### Risques

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Un ancien code écrit un jeton rénommé pendant la fenêtre | faible (coupure imposée) | 500 sur l'écriture concernée | coupure des écritures ; recherche des `invalid input value for enum` dans les journaux |
| Un ancien frontend lit `ANNULE` et ne trouve plus son libellé | moyenne (cache navigateur) | libellé affiché en code brut, filtres inopérants | le mapping de compatibilité du backend accepte les anciens jetons en entrée ; la normalisation des réponses côté front couvre le cas inverse ; purge des bundles le jour J |
| Un pointage hors ligne `PLANIFIEE` est refusé par le backend | moyenne (file de 7 jours conservée) | pointage perdu | migration du fichier local au démarrage ; à défaut, `POST /controles/sync` accepte l'ancien jeton via le mapping |
| Oubli d'un jeton dans une chaîne (SQL brut, JSON, script) | moyenne | 400/500 isolé | recherche exhaustive (cf. §8) ; le mapping de compatibilité absorbe les cas entrants |
| Un rapport ou un export fige l'ancien jeton | faible | incohérence d'archive | le rapport est rejoué avec le nouveau code ; les exports sont produits à la volée |
| Migration appliquée à une base dont le schéma diffère | faible | échec du `migrate deploy` | `migrate deploy` refuse de s'appliquer si l'historique ne correspond pas ; sauvegarde avant |
| Un journal d'audit mélange deux vocabulaires d'actions | écarté par conception | nul | les actions et détails de transition conservent leur écriture historique (§4) |

## 8. Vérifications

- **Recherche exhaustive** des 24 anciens jetons dans tout le dépôt (`*.ts`, `*.vue`, `*.prisma`,
  `*.sql`, `*.json`, `*.cjs`, `*.md`), y compris chaînes, SQL brut et JSON. Sont exclus : les
  migrations déjà appliquées (histoire de la base, non réécrites), les rapports d'audit
  (`docs/audits/` — archives) et ce document.
- **Backend** : `tsc --noEmit` puis `jest --runInBand` (suite complète).
- **Frontend** : `bun run typecheck`, `bun run test:unit`, `bun run lint`.
  Les tables de tons (`frontend/src/shared/utils/statuts.ts`) sont contraintes par
  `satisfies Record<StatutX, Ton>` : le typage échoue si un jeton du schéma et son miroir
  frontend divergent — c'est le garde-fou principal de cette harmonisation.
- **Migration** : SQL relu à la main, jamais exécuté sur une base de production. Elle est
  réversible ligne à ligne. Un contrôle automatique a vérifié, sur la branche, que les 39
  instructions correspondent exactement aux 39 couples d'énumérés ci-dessus, que l'ordre des
  valeurs est conservé dans chaque enum, qu'aucune valeur en double n'apparaît, que le script
  inverse est le miroir exact, et que la table de compatibilité couvre tous les couples.

### Résultats

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit -p tsconfig.json` (backend) | passe |
| `jest --runInBand` (backend) | 129 suites, **1161 tests** verts (1153 avant, +8 pour la compatibilité) |
| `bun run typecheck` (front) | passe |
| `bun run test:unit` (front) | 8 fichiers, **156 tests** verts (151 avant, +5 pour la compatibilité) |
| `bun run lint` (front) | **0 erreur** (201 avertissements préexistants : `no-explicit-any`, `no-unused-vars`) |
| Recherche exhaustive des 24 anciens jetons | plus aucune occurrence hors exceptions ci-dessous |
| Concordance migration / schéma / table de compatibilité | vérifiée par script |

Restent volontairement en écriture ancienne : les migrations déjà appliquées (histoire de la
base), les rapports d'audit (`docs/audits/`, archives), ce document, la table de
compatibilité (backend et front), les tests de compatibilité, le vocabulaire du journal d'audit
et le script inverse de la migration.
