-- Consentement à l'enrôlement biométrique.
--
-- Le gabarit lui-même passe au chiffrement au repos (voir common/coffre.ts et
-- scripts/chiffrer-empreintes.ts) : la colonne ne change pas de type, seul son
-- contenu devient illisible sans la clé.
ALTER TABLE "Enseignant" ADD COLUMN "empreinteConsentementLe" TIMESTAMP(3);
ALTER TABLE "Enseignant" ADD COLUMN "empreinteConsentementPar" TEXT;

-- Les enrôlements existants sont des données de démonstration : on ne leur
-- invente pas un consentement rétroactif, ils devront être refaits.
