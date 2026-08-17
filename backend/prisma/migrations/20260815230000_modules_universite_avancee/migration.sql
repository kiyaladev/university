-- CreateEnum
CREATE TYPE "StatutReparation" AS ENUM ('DECLARE', 'EN_COURS', 'TERMINE', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeCourrier" AS ENUM ('ENTRANT', 'SORTANT');

-- CreateEnum
CREATE TYPE "StatutCourrier" AS ENUM ('RECU', 'ENREGISTRE', 'EN_CIRCUIT', 'TRAITE', 'CLASSE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "TypeExamen" AS ENUM ('PARTIEL', 'FINAL', 'RATTRAPAGE', 'CONTROLE_CONTINU');

-- CreateEnum
CREATE TYPE "StatutExamen" AS ENUM ('PLANIFIE', 'EN_COURS', 'TERMINE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StadeTirage" AS ENUM ('PROGRAMME', 'IMPRIME', 'MIS_SOUS_PLI', 'DISTRIBUE', 'RECUPERE', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeRecette" AS ENUM ('ANALYSE_LABO', 'LOCATION_AMPHI', 'PRESTATION_FORMATION', 'PRESTATION_CONSEIL', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeReclamation" AS ENUM ('NOTE_MANQUANTE', 'ERREUR_SAISIE', 'INSCRIPTION', 'ENSEIGNEMENT', 'SCOLARITE', 'TECHNIQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "PrioriteReclamation" AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "StatutReclamation" AS ENUM ('OUVERTE', 'EN_COURS', 'EN_ATTENTE_REPONSE', 'RESOLUE', 'FERMEE', 'REJETEE');

-- CreateEnum
CREATE TYPE "TypeDemandeDocument" AS ENUM ('ATTESTATION_SCOLARITE', 'ATTESTATION_FREQUENTATION', 'RELEVE_NOTES', 'DUPLICATA_CARTE', 'ATTESTATION_REUSSITE', 'CERTIFICAT_SCOLARITE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('EN_ATTENTE_PAIEMENT', 'PAYEE', 'EN_TRAITEMENT', 'PRETE', 'REMISE', 'REJETEE');

-- CreateEnum
CREATE TYPE "TypeElection" AS ENUM ('DELEGUE_PROMOTION', 'DELEGUE_DEPARTEMENT', 'PRESIDENT_UNIVERSITE', 'SYNDICAT', 'CLUB');

-- CreateEnum
CREATE TYPE "StatutElection" AS ENUM ('BROUILLON', 'OUVERTE', 'CLOSE', 'PROCLAMEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "ModeVote" AS ENUM ('WEB', 'KIOSQUE', 'SMS');

-- CreateEnum
CREATE TYPE "StatutBadge" AS ENUM ('ACTIF', 'EXPIRE', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeRessourceVOD" AS ENUM ('AUDIO', 'VIDEO', 'NOTES', 'TRANSCRIPTION');

-- CreateEnum
CREATE TYPE "StatutVOD" AS ENUM ('BROUILLON', 'EN_LIGNE', 'HORS_LIGNE', 'ARCHIVE');

-- DropIndex
DROP INDEX "DocumentDepot_contenuTexte_trgm";

-- DropIndex
DROP INDEX "DocumentDepot_motsClefs_idx";

-- DropIndex
DROP INDEX "DocumentDepot_recherche_idx";

-- DropIndex
DROP INDEX "DocumentDepot_resume_trgm";

-- DropIndex
DROP INDEX "DocumentDepot_titre_trgm";

-- AlterTable
ALTER TABLE "TicketSupport" ADD COLUMN     "equipementPatrimoineId" TEXT;

-- CreateTable
CREATE TABLE "StatistiqueMesrs" (
    "id" TEXT NOT NULL,
    "anneeId" TEXT NOT NULL,
    "donnees" JSONB NOT NULL,
    "genereLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "genereParId" TEXT,

    CONSTRAINT "StatistiqueMesrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriePatrimoine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "dureeAmortissement" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategoriePatrimoine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipementPatrimoine" (
    "id" TEXT NOT NULL,
    "numeroSerie" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "departementId" TEXT,
    "salleId" TEXT,
    "dateAcquisition" DATE,
    "valeurAcquisition" DOUBLE PRECISION,
    "numeroInventaire" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "enReparation" BOOLEAN NOT NULL DEFAULT false,
    "obsolescenceMois" INTEGER DEFAULT 60,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipementPatrimoine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReparationMateriel" (
    "id" TEXT NOT NULL,
    "equipementId" TEXT NOT NULL,
    "dateDeclaration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "prestataire" TEXT,
    "cout" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" "StatutReparation" NOT NULL DEFAULT 'DECLARE',
    "dateResolution" TIMESTAMP(3),
    "declareParId" TEXT,
    "resoluParId" TEXT,
    "notes" TEXT,

    CONSTRAINT "ReparationMateriel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courrier" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" "TypeCourrier" NOT NULL,
    "objet" TEXT NOT NULL,
    "expediteur" TEXT,
    "destinataire" TEXT,
    "dateReception" DATE,
    "dateEnvoi" DATE,
    "fichier" TEXT,
    "typeMime" TEXT,
    "tailleKo" INTEGER,
    "numeroReference" TEXT,
    "paraphe" TEXT,
    "statut" "StatutCourrier" NOT NULL DEFAULT 'RECU',
    "enregistreParId" TEXT,
    "traiteParId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Courrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircuitCourrier" (
    "id" TEXT NOT NULL,
    "courrierId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "valideurId" TEXT,
    "roleValideur" TEXT,
    "statut" "StatutCourrier" NOT NULL DEFAULT 'EN_CIRCUIT',
    "paraphe" TEXT,
    "parapheLe" TIMESTAMP(3),
    "commentaire" TEXT,

    CONSTRAINT "CircuitCourrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Examen" (
    "id" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "type" "TypeExamen" NOT NULL DEFAULT 'FINAL',
    "matiereId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "anneeId" TEXT NOT NULL,
    "dateExamen" TIMESTAMP(3) NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "salleId" TEXT,
    "nbInscrits" INTEGER NOT NULL DEFAULT 0,
    "nbPresents" INTEGER NOT NULL DEFAULT 0,
    "codeExamen" TEXT NOT NULL,
    "statut" "StatutExamen" NOT NULL DEFAULT 'PLANIFIE',
    "creeParId" TEXT,
    "surveillantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Examen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanExamen" (
    "id" TEXT NOT NULL,
    "examenId" TEXT NOT NULL,
    "inscriptionId" TEXT,
    "matriculeSaisi" TEXT,
    "nomPorteur" TEXT,
    "prenomPorteur" TEXT,
    "heureScan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valide" BOOLEAN NOT NULL DEFAULT true,
    "motifRejet" TEXT,
    "scanneurId" TEXT,
    "ipAppareil" TEXT,

    CONSTRAINT "ScanExamen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tirage" (
    "id" TEXT NOT NULL,
    "examenId" TEXT NOT NULL,
    "dateTirage" TIMESTAMP(3) NOT NULL,
    "imprimeurId" TEXT,
    "nbExemplaires" INTEGER NOT NULL DEFAULT 0,
    "empreinteSource" TEXT NOT NULL,
    "empreinteExemplaires" TEXT,
    "circuitImpression" TEXT,
    "stade" "StadeTirage" NOT NULL DEFAULT 'PROGRAMME',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tirage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecetteExterne" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" "TypeRecette" NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'GNF',
    "date" DATE NOT NULL,
    "client" TEXT,
    "factureNum" TEXT,
    "paiementId" TEXT,
    "creeParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecetteExterne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reclamation" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" "TypeReclamation" NOT NULL,
    "sujet" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "anonyme" BOOLEAN NOT NULL DEFAULT false,
    "etudiantId" TEXT,
    "nomAuteur" TEXT,
    "emailAuteur" TEXT,
    "priorite" "PrioriteReclamation" NOT NULL DEFAULT 'NORMALE',
    "statut" "StatutReclamation" NOT NULL DEFAULT 'OUVERTE',
    "departementId" TEXT,
    "assigneAId" TEXT,
    "delaiEscaladeHeures" INTEGER DEFAULT 48,
    "escaladeLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fermeLe" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Reclamation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReclamation" (
    "id" TEXT NOT NULL,
    "reclamationId" TEXT NOT NULL,
    "auteurId" TEXT,
    "nomAffichage" TEXT,
    "contenu" TEXT NOT NULL,
    "joint" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReclamation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeDocument" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" "TypeDemandeDocument" NOT NULL,
    "motif" TEXT,
    "etudiantId" TEXT NOT NULL,
    "inscriptionId" TEXT,
    "frais" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT NOT NULL DEFAULT 'GNF',
    "paiementId" TEXT,
    "statut" "StatutDemande" NOT NULL DEFAULT 'EN_ATTENTE_PAIEMENT',
    "notification" TEXT,
    "traiteParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remiseLe" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "DemandeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifDemande" (
    "id" TEXT NOT NULL,
    "type" "TypeDemandeDocument" NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT NOT NULL DEFAULT 'GNF',
    "delaiHeures" INTEGER NOT NULL DEFAULT 72,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarifDemande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" "TypeElection" NOT NULL,
    "promotionId" TEXT,
    "departementId" TEXT,
    "description" TEXT,
    "dateOuverture" TIMESTAMP(3) NOT NULL,
    "dateCloture" TIMESTAMP(3) NOT NULL,
    "nbSieges" INTEGER NOT NULL DEFAULT 1,
    "bulletin" TEXT,
    "statut" "StatutElection" NOT NULL DEFAULT 'BROUILLON',
    "creeParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatElection" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "etudiantId" TEXT,
    "enseignantId" TEXT,
    "photoUrl" TEXT,
    "programme" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CandidatElection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteElection" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "candidatId" TEXT NOT NULL,
    "etudiantId" TEXT,
    "scrutinId" TEXT,
    "mode" "ModeVote" NOT NULL DEFAULT 'WEB',
    "ipAppareil" TEXT,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteElection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarteEtudiante" (
    "id" TEXT NOT NULL,
    "etudiantId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateValidite" TIMESTAMP(3),
    "statut" "StatutAttestation" NOT NULL DEFAULT 'EMISE',
    "motifRevocation" TEXT,
    "photoUrl" TEXT,
    "nip" TEXT,
    "creeParId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CarteEtudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeAcces" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "fonction" TEXT,
    "organisation" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "pieceIdentite" TEXT,
    "numeroPiece" TEXT,
    "dateDelivrance" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateValidite" TIMESTAMP(3) NOT NULL,
    "zonesAccess" TEXT,
    "qrToken" TEXT NOT NULL,
    "statut" "StatutBadge" NOT NULL DEFAULT 'ACTIF',
    "motif" TEXT,
    "creeParId" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BadgeAcces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursVOD" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "matiereId" TEXT,
    "seanceId" TEXT,
    "enseignantId" TEXT,
    "type" "TypeRessourceVOD" NOT NULL DEFAULT 'VIDEO',
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "dureeSecondes" INTEGER,
    "tailleKo" INTEGER,
    "transcription" TEXT,
    "nbVues" INTEGER NOT NULL DEFAULT 0,
    "nbComplets" INTEGER NOT NULL DEFAULT 0,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "inscriptionId" TEXT,
    "statut" "StatutVOD" NOT NULL DEFAULT 'BROUILLON',
    "creeParId" TEXT,
    "dateMiseEnLigne" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursVOD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VueVOD" (
    "id" TEXT NOT NULL,
    "vodId" TEXT NOT NULL,
    "etudiantId" TEXT,
    "positionSecondes" INTEGER NOT NULL DEFAULT 0,
    "termine" BOOLEAN NOT NULL DEFAULT false,
    "dureeSecondes" INTEGER NOT NULL DEFAULT 0,
    "ipAppareil" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),

    CONSTRAINT "VueVOD_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatistiqueMesrs_anneeId_genereLe_idx" ON "StatistiqueMesrs"("anneeId", "genereLe");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriePatrimoine_code_key" ON "CategoriePatrimoine"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EquipementPatrimoine_numeroSerie_key" ON "EquipementPatrimoine"("numeroSerie");

-- CreateIndex
CREATE UNIQUE INDEX "EquipementPatrimoine_numeroInventaire_key" ON "EquipementPatrimoine"("numeroInventaire");

-- CreateIndex
CREATE UNIQUE INDEX "EquipementPatrimoine_qrCode_key" ON "EquipementPatrimoine"("qrCode");

-- CreateIndex
CREATE INDEX "EquipementPatrimoine_categorieId_idx" ON "EquipementPatrimoine"("categorieId");

-- CreateIndex
CREATE INDEX "EquipementPatrimoine_actif_idx" ON "EquipementPatrimoine"("actif");

-- CreateIndex
CREATE INDEX "ReparationMateriel_statut_idx" ON "ReparationMateriel"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Courrier_numero_key" ON "Courrier"("numero");

-- CreateIndex
CREATE INDEX "Courrier_type_statut_idx" ON "Courrier"("type", "statut");

-- CreateIndex
CREATE INDEX "CircuitCourrier_courrierId_ordre_idx" ON "CircuitCourrier"("courrierId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "Examen_codeExamen_key" ON "Examen"("codeExamen");

-- CreateIndex
CREATE INDEX "Examen_dateExamen_idx" ON "Examen"("dateExamen");

-- CreateIndex
CREATE INDEX "Examen_promotionId_idx" ON "Examen"("promotionId");

-- CreateIndex
CREATE INDEX "ScanExamen_examenId_heureScan_idx" ON "ScanExamen"("examenId", "heureScan");

-- CreateIndex
CREATE INDEX "Tirage_examenId_idx" ON "Tirage"("examenId");

-- CreateIndex
CREATE UNIQUE INDEX "RecetteExterne_numero_key" ON "RecetteExterne"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "RecetteExterne_paiementId_key" ON "RecetteExterne"("paiementId");

-- CreateIndex
CREATE INDEX "RecetteExterne_type_date_idx" ON "RecetteExterne"("type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Reclamation_numero_key" ON "Reclamation"("numero");

-- CreateIndex
CREATE INDEX "Reclamation_statut_priorite_idx" ON "Reclamation"("statut", "priorite");

-- CreateIndex
CREATE INDEX "Reclamation_etudiantId_idx" ON "Reclamation"("etudiantId");

-- CreateIndex
CREATE INDEX "MessageReclamation_reclamationId_creeLe_idx" ON "MessageReclamation"("reclamationId", "creeLe");

-- CreateIndex
CREATE UNIQUE INDEX "DemandeDocument_numero_key" ON "DemandeDocument"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "DemandeDocument_paiementId_key" ON "DemandeDocument"("paiementId");

-- CreateIndex
CREATE INDEX "DemandeDocument_etudiantId_statut_idx" ON "DemandeDocument"("etudiantId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "TarifDemande_type_key" ON "TarifDemande"("type");

-- CreateIndex
CREATE INDEX "Election_statut_dateOuverture_idx" ON "Election"("statut", "dateOuverture");

-- CreateIndex
CREATE INDEX "CandidatElection_electionId_ordre_idx" ON "CandidatElection"("electionId", "ordre");

-- CreateIndex
CREATE INDEX "VoteElection_electionId_candidatId_idx" ON "VoteElection"("electionId", "candidatId");

-- CreateIndex
CREATE UNIQUE INDEX "VoteElection_electionId_candidatId_etudiantId_key" ON "VoteElection"("electionId", "candidatId", "etudiantId");

-- CreateIndex
CREATE UNIQUE INDEX "CarteEtudiante_etudiantId_key" ON "CarteEtudiante"("etudiantId");

-- CreateIndex
CREATE UNIQUE INDEX "CarteEtudiante_qrToken_key" ON "CarteEtudiante"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeAcces_numero_key" ON "BadgeAcces"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeAcces_qrToken_key" ON "BadgeAcces"("qrToken");

-- CreateIndex
CREATE INDEX "BadgeAcces_statut_dateValidite_idx" ON "BadgeAcces"("statut", "dateValidite");

-- CreateIndex
CREATE INDEX "CoursVOD_type_statut_idx" ON "CoursVOD"("type", "statut");

-- CreateIndex
CREATE INDEX "CoursVOD_matiereId_idx" ON "CoursVOD"("matiereId");

-- CreateIndex
CREATE INDEX "VueVOD_vodId_etudiantId_idx" ON "VueVOD"("vodId", "etudiantId");

-- AddForeignKey
ALTER TABLE "TicketSupport" ADD CONSTRAINT "TicketSupport_equipementPatrimoineId_fkey" FOREIGN KEY ("equipementPatrimoineId") REFERENCES "EquipementPatrimoine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatistiqueMesrs" ADD CONSTRAINT "StatistiqueMesrs_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatistiqueMesrs" ADD CONSTRAINT "StatistiqueMesrs_genereParId_fkey" FOREIGN KEY ("genereParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipementPatrimoine" ADD CONSTRAINT "EquipementPatrimoine_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategoriePatrimoine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipementPatrimoine" ADD CONSTRAINT "EquipementPatrimoine_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipementPatrimoine" ADD CONSTRAINT "EquipementPatrimoine_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReparationMateriel" ADD CONSTRAINT "ReparationMateriel_equipementId_fkey" FOREIGN KEY ("equipementId") REFERENCES "EquipementPatrimoine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReparationMateriel" ADD CONSTRAINT "ReparationMateriel_declareParId_fkey" FOREIGN KEY ("declareParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReparationMateriel" ADD CONSTRAINT "ReparationMateriel_resoluParId_fkey" FOREIGN KEY ("resoluParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_enregistreParId_fkey" FOREIGN KEY ("enregistreParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_traiteParId_fkey" FOREIGN KEY ("traiteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircuitCourrier" ADD CONSTRAINT "CircuitCourrier_courrierId_fkey" FOREIGN KEY ("courrierId") REFERENCES "Courrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircuitCourrier" ADD CONSTRAINT "CircuitCourrier_valideurId_fkey" FOREIGN KEY ("valideurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_surveillantId_fkey" FOREIGN KEY ("surveillantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanExamen" ADD CONSTRAINT "ScanExamen_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanExamen" ADD CONSTRAINT "ScanExamen_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanExamen" ADD CONSTRAINT "ScanExamen_scanneurId_fkey" FOREIGN KEY ("scanneurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tirage" ADD CONSTRAINT "Tirage_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tirage" ADD CONSTRAINT "Tirage_imprimeurId_fkey" FOREIGN KEY ("imprimeurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetteExterne" ADD CONSTRAINT "RecetteExterne_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "Paiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetteExterne" ADD CONSTRAINT "RecetteExterne_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_assigneAId_fkey" FOREIGN KEY ("assigneAId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReclamation" ADD CONSTRAINT "MessageReclamation_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "Reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReclamation" ADD CONSTRAINT "MessageReclamation_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeDocument" ADD CONSTRAINT "DemandeDocument_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeDocument" ADD CONSTRAINT "DemandeDocument_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeDocument" ADD CONSTRAINT "DemandeDocument_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "Paiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeDocument" ADD CONSTRAINT "DemandeDocument_traiteParId_fkey" FOREIGN KEY ("traiteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatElection" ADD CONSTRAINT "CandidatElection_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatElection" ADD CONSTRAINT "CandidatElection_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatElection" ADD CONSTRAINT "CandidatElection_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Enseignant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteElection" ADD CONSTRAINT "VoteElection_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteElection" ADD CONSTRAINT "VoteElection_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "CandidatElection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteElection" ADD CONSTRAINT "VoteElection_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarteEtudiante" ADD CONSTRAINT "CarteEtudiante_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarteEtudiante" ADD CONSTRAINT "CarteEtudiante_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAcces" ADD CONSTRAINT "BadgeAcces_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursVOD" ADD CONSTRAINT "CoursVOD_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursVOD" ADD CONSTRAINT "CoursVOD_seanceId_fkey" FOREIGN KEY ("seanceId") REFERENCES "Seance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursVOD" ADD CONSTRAINT "CoursVOD_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Enseignant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursVOD" ADD CONSTRAINT "CoursVOD_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursVOD" ADD CONSTRAINT "CoursVOD_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VueVOD" ADD CONSTRAINT "VueVOD_vodId_fkey" FOREIGN KEY ("vodId") REFERENCES "CoursVOD"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VueVOD" ADD CONSTRAINT "VueVOD_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

