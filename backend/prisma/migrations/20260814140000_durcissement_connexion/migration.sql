-- Durcissement de la connexion.
--
-- « tentativesEchouees » et « verrouilleJusqua » portent le verrouillage
-- temporaire après échecs répétés ; « motDePasseModifieLe » permet d'invalider
-- d'un coup tous les jetons émis avant un changement de mot de passe.
ALTER TABLE "User" ADD COLUMN "tentativesEchouees" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "verrouilleJusqua" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "motDePasseModifieLe" TIMESTAMP(3);

-- Les comptes existants n'ont jamais changé de mot de passe depuis leur
-- création : on prend cette date comme référence, sinon leurs jetons en cours
-- seraient tous rejetés au premier déploiement.
UPDATE "User" SET "motDePasseModifieLe" = "createdAt";
