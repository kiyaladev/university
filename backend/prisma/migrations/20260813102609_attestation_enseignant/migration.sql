-- CreateEnum
CREATE TYPE "AttestationMode" AS ENUM ('AUCUNE', 'SIGNATURE', 'CODE_PIN', 'EMPREINTE', 'PASSKEY');

-- CreateEnum
CREATE TYPE "StatutDemandeAttestation" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'EXPIREE');

-- AlterTable
ALTER TABLE "Controle" ADD COLUMN     "attestation" "AttestationMode" NOT NULL DEFAULT 'AUCUNE',
ADD COLUMN     "attestationLe" TIMESTAMP(3),
ADD COLUMN     "attestationValide" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "empreinteScore" INTEGER,
ADD COLUMN     "passkeyId" TEXT;

-- AlterTable
ALTER TABLE "Enseignant" ADD COLUMN     "codePin" TEXT,
ADD COLUMN     "codePinDefiniLe" TIMESTAMP(3),
ADD COLUMN     "empreinteDoigt" TEXT,
ADD COLUMN     "empreinteEnroleeLe" TIMESTAMP(3),
ADD COLUMN     "empreinteTemplate" TEXT;

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "compteur" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT,
    "appareil" TEXT,
    "dernierUsage" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeAttestation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "seanceId" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "demandeParId" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "statut" "StatutDemandeAttestation" NOT NULL DEFAULT 'EN_ATTENTE',
    "passkeyId" TEXT,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "valideeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandeAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "DemandeAttestation_token_key" ON "DemandeAttestation"("token");

-- CreateIndex
CREATE INDEX "DemandeAttestation_statut_expireLe_idx" ON "DemandeAttestation"("statut", "expireLe");

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Enseignant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAttestation" ADD CONSTRAINT "DemandeAttestation_seanceId_fkey" FOREIGN KEY ("seanceId") REFERENCES "Seance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAttestation" ADD CONSTRAINT "DemandeAttestation_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Enseignant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAttestation" ADD CONSTRAINT "DemandeAttestation_demandeParId_fkey" FOREIGN KEY ("demandeParId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAttestation" ADD CONSTRAINT "DemandeAttestation_passkeyId_fkey" FOREIGN KEY ("passkeyId") REFERENCES "Passkey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
