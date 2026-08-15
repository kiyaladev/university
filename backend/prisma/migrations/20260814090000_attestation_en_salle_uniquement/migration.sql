-- L'attestation de présence appartient au geste du contrôleur, en salle, sur son
-- appareil. L'enseignant n'atteste plus depuis son propre téléphone : les clés
-- d'accès (WebAuthn) et les demandes d'attestation à distance disparaissent.

-- Le contrôle ne référence plus de clé d'accès.
ALTER TABLE "Controle" DROP COLUMN IF EXISTS "passkeyId";

DROP TABLE IF EXISTS "DemandeAttestation";
DROP TABLE IF EXISTS "Passkey";
DROP TYPE IF EXISTS "StatutDemandeAttestation";

-- PostgreSQL ne sait pas retirer une valeur d'énumération : on reconstruit le type.
ALTER TABLE "Controle" ALTER COLUMN "attestation" DROP DEFAULT;
CREATE TYPE "AttestationMode_new" AS ENUM ('AUCUNE', 'SIGNATURE', 'CODE_PIN', 'EMPREINTE');
ALTER TABLE "Controle"
  ALTER COLUMN "attestation" TYPE "AttestationMode_new"
  USING ("attestation"::text::"AttestationMode_new");
ALTER TYPE "AttestationMode" RENAME TO "AttestationMode_old";
ALTER TYPE "AttestationMode_new" RENAME TO "AttestationMode";
DROP TYPE "AttestationMode_old";
ALTER TABLE "Controle" ALTER COLUMN "attestation" SET DEFAULT 'AUCUNE';
