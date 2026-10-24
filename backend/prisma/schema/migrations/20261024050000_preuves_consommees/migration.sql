-- Registre des preuves biométriques déjà consommées.
--
-- Une lecture d'empreinte signée par la passerelle est un authentificateur :
-- rejouée telle quelle pendant la fenêtre d'acceptation (cinq minutes), elle
-- ferait passer un pointage sans nouvelle lecture du doigt. L'API inscrit donc
-- chaque preuve acceptée au registre, et refuse (409) toute preuve déjà
-- consommée.
--
-- La clé de consommation est unique : « nonce:<tentativeId> » quand la charge
-- signée porte le nonce de la tentative, sinon « signature:<empreinte> ». Ce
-- n'est pas un secret : c'est un identifiant de preuve, pas une clé.
--
-- Les entrées portent leur date d'expiration : une preuve n'étant rejouable
-- que pendant sa fenêtre, le registre est purgé au-delà (index sur "expireLe").
CREATE TABLE "PreuveConsommee" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "appareilId" TEXT,
    "score" INTEGER,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreuveConsommee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PreuveConsommee_cle_key" ON "PreuveConsommee"("cle");

CREATE INDEX "PreuveConsommee_expireLe_idx" ON "PreuveConsommee"("expireLe");
