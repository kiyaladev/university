# Types du frontend

Ce dossier décrit les types que le frontend échange avec l'API University.

Deux origines, deux traitements :

- **les énumérations** sont générées depuis le schéma Prisma ;
- **les interfaces de données** sont écrites à la main.

## Énumérations : fichier généré

`generated/enums.ts` est produit par `scripts/generer-types-enums.ts` à la racine
du dépôt :

```bash
bun run types:generer   # écrit frontend/src/types/generated/enums.ts
bun run types:verifier  # échoue si le fichier n'est plus à jour
```

Le fichier est versionné : la CI (`bun run types:verifier`) refuse un dépôt
dont le fichier généré ne correspond plus au schéma Prisma. **Ne jamais
l'éditer à la main** : toute modification est écrasée à la prochaine
génération.

Chaque enum Prisma produit deux exports de même nom :

```ts
export const Role = { ADMIN: 'ADMIN', /* … */ } as const;
export type Role = (typeof Role)[keyof typeof Role];
```

- le **type** est celui qu'utilisent les modules de domaine (`types/referentiels.ts`,
  `types/registre.ts`, …) ; il est réexporté par le fichier du domaine qui le
  possède, pour que les imports existants (`from '@/types'`,
  `from '@/types/referentiels'`) restent valables ;
- la **constante** est un objet `as const` utilisable à l'exécution. Elle n'est
  volontairement pas réexportée par les modules de domaine : la surface publique
  de `@/types` reste identique à ce qu'elle était. Elle est disponible via
  `@/types/generated/enums` quand un composant a besoin de la liste des
  valeurs.

Le générateur lit `backend/prisma/schema.prisma`, ou l'ensemble des fichiers
`backend/prisma/schema/*.prisma` quand le schéma est découpé en plusieurs
fichiers. Il conserve les commentaires `///` du schéma.

Les types qui ne sont pas des enums Prisma restent écrits à la main :

- `TypeBadge` : la colonne `BadgeAcces.type` est une chaîne libre en base ;
- `StatutCarteEtudiante` : le modèle `CarteEtudiante` réutilise l'enum Prisma
  `StatutAttestation` (EMIS / REVOQUE), le nom d'usage est conservé.

Les unions écrites en ligne sont interdites : un enum utilisé dans une
interface est un type nommé, généré (`MethodeVerification`,
`StatutSuspicionPlagiat`, `SessionDeliberation`).

## Interfaces de données : écrites à la main

Les interfaces (`Etudiant`, `Seance`, `Paiement`, …) ne sont **pas** générées
depuis Prisma, et ce n'est pas un oubli : une réponse de l'API n'est pas un
modèle Prisma.

- les **relations** sont des sous-ensembles : `etudiant?: Pick<Etudiant, 'id' | 'matricule'>`,
  `salle?: Pick<Salle, 'id' | 'code' | 'nom'>` ;
- certains **champs sont absents** de la réponse (`nip`, `empreinteConsentementLe`,
  `passwordHash`, …) ;
- les **`Decimal`** (`montant`, `cout`, `valeurAcquisition`) sont convertis en
  `number` par la couche de sérialisation ;
- les **dates** sont des chaînes ISO, pas des `Date` ;
- les **agrégats** (`_count`, `_sum`) n'existent pas dans le modèle ;
- les **champs calculés** des endpoints (`tauxReussite`, `masseSalariale`,
  `participation`) n'ont aucune contrepartie en base.

Un modèle généré serait donc faux dans tous les cas : il exposerait des champs
que l'API ne renvoie pas et typrait des montants en `Decimal`. Les interfaces
restent donc écrites à la main, avec les champs optionnels là où l'API les
omet — et c'est ce que la revue humaine vérifie.

En revanche, les **énumérations** sont partagées : une valeur d'état qui
change en base doit changer partout, dans le back comme dans le front. C'est
exactement ce que la génération apporte.
