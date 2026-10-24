-- Horodatage de dernière modification sur les modèles modifiés après création.
--
-- Décision et analyse complète : docs/decisions/donnees.md (§ « Horodatages »).
--
-- Vingt et un modèles sont modifiés après leur création (update, updateMany ou
-- upsert dans le code) mais ne portaient pas de champ `updatedAt` : la
-- dernière écriture d'un document n'était donc pas datée. Le champ est ajouté
-- ici sous la forme que Prisma produit pour une table déjà remplie :
--
--   ALTER TABLE "X" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
--   ALTER TABLE "X" ALTER COLUMN "updatedAt" DROP DEFAULT;
--
-- Le défaut n'existe que le temps du remplissage : les lignes existantes
-- reçoivent la date de la migration, les lignes créées ensuite sont datées
-- par le client Prisma (`@updatedAt`). C'est exactement le SQL que
-- `prisma migrate dev` génère sur une base non vide ; le diff hors ligne
-- (`prisma migrate diff --script`), qui ignore les données, propose un
-- `ADD COLUMN … NOT NULL` sans défaut, qui échouerait sur une table
-- peuplée.
--
-- Modèles concernés (vérifiés sur les `update` / `updateMany` / `upsert` du
-- code applicatif et du seed) :
--
--   Affectation, AnneeAcademique, Appareil, CarteEtudiante,
--   CategoriePatrimoine, CircuitCourrier, ConsommationResto, Creneau,
--   DeliberationLigne, DemandeDocument, EquipementCampus, Filiere,
--   InscriptionFormation, Note, Promotion, RecetteExterne, Reclamation,
--   ReparationMateriel, ReservationSalle, Soutenance, SuspicionPlagiat.
--
-- Modèles volontairement laissés tels quels : ils ne sont jamais modifiés
-- après création (journal en lecture seule, preuve, bulletin de vote,
-- vue VOD…). Leur écrire un `updatedAt` serait un champ qui ne change
-- jamais.
--
-- Retour arrière : la colonne est supprimée, le code applicatif est
-- redéployé dans le même temps.
--
--   ALTER TABLE "X" DROP COLUMN "updatedAt";

-- ---------------------------------------------------------------------------
-- Référentiel
-- ---------------------------------------------------------------------------

ALTER TABLE "Affectation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Affectation" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "AnneeAcademique" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AnneeAcademique" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Filiere" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Filiere" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Promotion" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Promotion" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Présence
-- ---------------------------------------------------------------------------

ALTER TABLE "Appareil" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Appareil" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Creneau" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Creneau" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Scolarité
-- ---------------------------------------------------------------------------

ALTER TABLE "Note" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Note" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "DeliberationLigne" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DeliberationLigne" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "InscriptionFormation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "InscriptionFormation" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Soutenance" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Soutenance" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

ALTER TABLE "CarteEtudiante" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CarteEtudiante" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "DemandeDocument" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DemandeDocument" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Finances
-- ---------------------------------------------------------------------------

ALTER TABLE "RecetteExterne" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RecetteExterne" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Campus
-- ---------------------------------------------------------------------------

ALTER TABLE "CategoriePatrimoine" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CategoriePatrimoine" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "EquipementCampus" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EquipementCampus" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "ReparationMateriel" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ReparationMateriel" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "ReservationSalle" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ReservationSalle" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Reclamation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Reclamation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Courrier, recherche, vie étudiante
-- ---------------------------------------------------------------------------

ALTER TABLE "CircuitCourrier" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CircuitCourrier" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "SuspicionPlagiat" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SuspicionPlagiat" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "ConsommationResto" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ConsommationResto" ALTER COLUMN "updatedAt" DROP DEFAULT;
