-- Extensions FTS + trigrammes
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- CreateEnum
CREATE TYPE "StatutSuspicionPlagiat" AS ENUM ('EN_ATTENTE', 'ACQUITTE', 'CONFIRME');

-- AlterTable
ALTER TABLE "DocumentDepot" ADD COLUMN     "contenuTexte" TEXT,
ADD COLUMN     "empreinteHash" TEXT,
ADD COLUMN     "indicePlagiat" INTEGER DEFAULT 0,
ADD COLUMN     "motsClefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "recherche" tsvector;

-- CreateTable
CREATE TABLE "SuspicionPlagiat" (
    "id" TEXT NOT NULL,
    "documentAId" TEXT NOT NULL,
    "documentBId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "statut" "StatutSuspicionPlagiat" NOT NULL DEFAULT 'EN_ATTENTE',
    "detecteLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acquitteParId" TEXT,
    "acquitteLe" TIMESTAMP(3),
    "commentaire" TEXT,

    CONSTRAINT "SuspicionPlagiat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuspicionPlagiat_statut_idx" ON "SuspicionPlagiat"("statut");

-- CreateIndex
CREATE INDEX "SuspicionPlagiat_score_idx" ON "SuspicionPlagiat"("score");

-- CreateIndex
CREATE INDEX "DocumentDepot_empreinteHash_idx" ON "DocumentDepot"("empreinteHash");

-- AddForeignKey
ALTER TABLE "SuspicionPlagiat" ADD CONSTRAINT "SuspicionPlagiat_documentAId_fkey" FOREIGN KEY ("documentAId") REFERENCES "DocumentDepot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspicionPlagiat" ADD CONSTRAINT "SuspicionPlagiat_documentBId_fkey" FOREIGN KEY ("documentBId") REFERENCES "DocumentDepot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspicionPlagiat" ADD CONSTRAINT "SuspicionPlagiat_acquitteParId_fkey" FOREIGN KEY ("acquitteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Index GIN pour la recherche plein texte et trigrammes
CREATE INDEX "DocumentDepot_recherche_idx" ON "DocumentDepot" USING GIN ("recherche");
CREATE INDEX "DocumentDepot_motsClefs_idx" ON "DocumentDepot" USING GIN ("motsClefs");
CREATE INDEX "DocumentDepot_contenuTexte_trgm" ON "DocumentDepot" USING GIN ("contenuTexte" gin_trgm_ops);
CREATE INDEX "DocumentDepot_titre_trgm"      ON "DocumentDepot" USING GIN ("titre" gin_trgm_ops);
CREATE INDEX "DocumentDepot_resume_trgm"     ON "DocumentDepot" USING GIN ("resume" gin_trgm_ops);

-- Trigger : maintien automatique de la colonne tsvector
CREATE OR REPLACE FUNCTION "DocumentDepot_recherche_trigger"() RETURNS trigger AS $$
DECLARE
  piece text;
BEGIN
  piece := COALESCE(NEW."titre", '') || ' ' ||
           COALESCE(NEW."auteurs", '') || ' ' ||
           COALESCE(NEW."resume", '') || ' ' ||
           COALESCE(NEW."contenuTexte", '') || ' ' ||
           COALESCE(array_to_string(NEW."motsClefs", ' '), '');
  NEW."recherche" := to_tsvector('french', piece);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "DocumentDepot_recherche_update" ON "DocumentDepot";
CREATE TRIGGER "DocumentDepot_recherche_update"
  BEFORE INSERT OR UPDATE OF "titre", "auteurs", "resume", "contenuTexte", "motsClefs"
  ON "DocumentDepot"
  FOR EACH ROW
  EXECUTE FUNCTION "DocumentDepot_recherche_trigger"();

UPDATE "DocumentDepot" SET "recherche" = to_tsvector('french',
  COALESCE("titre", '') || ' ' ||
  COALESCE("auteurs", '') || ' ' ||
  COALESCE("resume", '') || ' ' ||
  COALESCE("contenuTexte", '') || ' ' ||
  COALESCE(array_to_string("motsClefs", ' '), '')
);
