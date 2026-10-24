-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR', 'ENSEIGNANT');

-- CreateEnum
CREATE TYPE "StatutEnseignant" AS ENUM ('PERMANENT', 'VACATAIRE', 'CONTRACTUEL');

-- CreateEnum
CREATE TYPE "TypeCours" AS ENUM ('CM', 'TD', 'TP', 'EXAMEN', 'CONFERENCE');

-- CreateEnum
CREATE TYPE "StatutSeance" AS ENUM ('PLANIFIEE', 'EN_COURS', 'CONTROLEE', 'ANNULEE', 'NON_TENUE');

-- CreateEnum
CREATE TYPE "StatutPresence" AS ENUM ('PRESENT', 'RETARD', 'ABSENT', 'DEPART_ANTICIPE', 'REMPLACE', 'EXCUSE');

-- CreateEnum
CREATE TYPE "MethodeVerification" AS ENUM ('MANUEL', 'QR_SALLE', 'GEOLOCALISATION', 'SIGNATURE');

-- CreateEnum
CREATE TYPE "TypeJustificatif" AS ENUM ('MALADIE', 'MISSION', 'FORMATION', 'DEUIL', 'TRANSPORT', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutJustificatif" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "Niveau" AS ENUM ('L1', 'L2', 'L3', 'M1', 'M2', 'DOCTORAT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CONTROLEUR',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "departementId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnneeAcademique" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "cloturee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnneeAcademique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Departement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "faculte" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Departement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filiere" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "departementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Filiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "niveau" "Niveau" NOT NULL,
    "effectif" INTEGER NOT NULL DEFAULT 0,
    "filiereId" TEXT NOT NULL,
    "anneeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "batiment" TEXT,
    "capacite" INTEGER NOT NULL DEFAULT 0,
    "qrToken" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "rayonMetres" INTEGER NOT NULL DEFAULT 80,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enseignant" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "grade" TEXT,
    "statut" "StatutEnseignant" NOT NULL DEFAULT 'PERMANENT',
    "tauxHoraire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "departementId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enseignant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matiere" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "volumeHoraireTotal" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "departementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affectation" (
    "id" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "anneeId" TEXT NOT NULL,
    "volumeHorairePrevu" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Affectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creneau" (
    "id" TEXT NOT NULL,
    "affectationId" TEXT NOT NULL,
    "jourSemaine" INTEGER NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "type" "TypeCours" NOT NULL DEFAULT 'CM',
    "salleId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Creneau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seance" (
    "id" TEXT NOT NULL,
    "affectationId" TEXT NOT NULL,
    "creneauId" TEXT,
    "anneeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "type" "TypeCours" NOT NULL DEFAULT 'CM',
    "salleId" TEXT,
    "statut" "StatutSeance" NOT NULL DEFAULT 'PLANIFIEE',
    "thematique" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Controle" (
    "id" TEXT NOT NULL,
    "seanceId" TEXT NOT NULL,
    "controleurId" TEXT NOT NULL,
    "statut" "StatutPresence" NOT NULL DEFAULT 'PRESENT',
    "heureArrivee" TEXT,
    "heureFinReelle" TEXT,
    "dureeMinutes" INTEGER NOT NULL DEFAULT 0,
    "effectifPresent" INTEGER,
    "thematiqueTraitee" TEXT,
    "observation" TEXT,
    "methode" "MethodeVerification" NOT NULL DEFAULT 'MANUEL',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "distanceMetres" INTEGER,
    "signatureBase64" TEXT,
    "qrSalleValide" BOOLEAN NOT NULL DEFAULT false,
    "enseignantRemplacantId" TEXT,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horsLigne" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Controle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Justificatif" (
    "id" TEXT NOT NULL,
    "seanceId" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "type" "TypeJustificatif" NOT NULL DEFAULT 'AUTRE',
    "motif" TEXT NOT NULL,
    "piece" TEXT,
    "statut" "StatutJustificatif" NOT NULL DEFAULT 'EN_ATTENTE',
    "traiteParId" TEXT,
    "commentaire" TEXT,
    "traiteLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Justificatif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametre" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametre_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "details" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AnneeAcademique_libelle_key" ON "AnneeAcademique"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "Departement_code_key" ON "Departement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Filiere_code_key" ON "Filiere"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_nom_anneeId_key" ON "Promotion"("nom", "anneeId");

-- CreateIndex
CREATE UNIQUE INDEX "Salle_code_key" ON "Salle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Salle_qrToken_key" ON "Salle"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "Enseignant_matricule_key" ON "Enseignant"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Enseignant_email_key" ON "Enseignant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Enseignant_userId_key" ON "Enseignant"("userId");

-- CreateIndex
CREATE INDEX "Enseignant_nom_prenom_idx" ON "Enseignant"("nom", "prenom");

-- CreateIndex
CREATE UNIQUE INDEX "Matiere_code_key" ON "Matiere"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Affectation_enseignantId_matiereId_promotionId_anneeId_key" ON "Affectation"("enseignantId", "matiereId", "promotionId", "anneeId");

-- CreateIndex
CREATE INDEX "Creneau_jourSemaine_idx" ON "Creneau"("jourSemaine");

-- CreateIndex
CREATE INDEX "Seance_date_statut_idx" ON "Seance"("date", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "Seance_affectationId_date_heureDebut_key" ON "Seance"("affectationId", "date", "heureDebut");

-- CreateIndex
CREATE UNIQUE INDEX "Controle_seanceId_key" ON "Controle"("seanceId");

-- CreateIndex
CREATE INDEX "Controle_statut_idx" ON "Controle"("statut");

-- CreateIndex
CREATE INDEX "Controle_horodatage_idx" ON "Controle"("horodatage");

-- CreateIndex
CREATE UNIQUE INDEX "Justificatif_seanceId_key" ON "Justificatif"("seanceId");

-- CreateIndex
CREATE INDEX "Justificatif_statut_idx" ON "Justificatif"("statut");

-- CreateIndex
CREATE INDEX "AuditLog_entite_entiteId_idx" ON "AuditLog"("entite", "entiteId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Filiere" ADD CONSTRAINT "Filiere_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_filiereId_fkey" FOREIGN KEY ("filiereId") REFERENCES "Filiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enseignant" ADD CONSTRAINT "Enseignant_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enseignant" ADD CONSTRAINT "Enseignant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matiere" ADD CONSTRAINT "Matiere_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Enseignant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creneau" ADD CONSTRAINT "Creneau_affectationId_fkey" FOREIGN KEY ("affectationId") REFERENCES "Affectation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creneau" ADD CONSTRAINT "Creneau_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_affectationId_fkey" FOREIGN KEY ("affectationId") REFERENCES "Affectation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_creneauId_fkey" FOREIGN KEY ("creneauId") REFERENCES "Creneau"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Controle" ADD CONSTRAINT "Controle_seanceId_fkey" FOREIGN KEY ("seanceId") REFERENCES "Seance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Controle" ADD CONSTRAINT "Controle_controleurId_fkey" FOREIGN KEY ("controleurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Controle" ADD CONSTRAINT "Controle_enseignantRemplacantId_fkey" FOREIGN KEY ("enseignantRemplacantId") REFERENCES "Enseignant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Justificatif" ADD CONSTRAINT "Justificatif_seanceId_fkey" FOREIGN KEY ("seanceId") REFERENCES "Seance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Justificatif" ADD CONSTRAINT "Justificatif_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Enseignant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Justificatif" ADD CONSTRAINT "Justificatif_traiteParId_fkey" FOREIGN KEY ("traiteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
