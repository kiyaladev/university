-- Appareils autorisés à signer des résultats biométriques.
--
-- La passerelle biométrique historique signe avec un secret unique partagé
-- avec le serveur. Ce modèle ne tient plus dès que le lecteur vit à
-- l'intérieur d'une application installée sur des téléphones : le secret
-- serait extractible de l'APK, et une vérification d'empreinte deviendrait
-- forgeable. Chaque appareil reçoit donc sa propre clé, révocable seule.
CREATE TABLE "Appareil" (
  "id"           TEXT NOT NULL,
  "libelle"      TEXT NOT NULL,
  "secret"       TEXT NOT NULL,
  "actif"        BOOLEAN NOT NULL DEFAULT true,
  "userId"       TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dernierUsage" TIMESTAMP(3),
  "revoqueLe"    TIMESTAMP(3),
  CONSTRAINT "Appareil_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appareil_actif_idx" ON "Appareil"("actif");

ALTER TABLE "Appareil" ADD CONSTRAINT "Appareil_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
