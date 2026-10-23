-- Index de recherche de la bibliothèque (DocumentDepot).
--
-- La migration 20260815230000_modules_universite_avancee a supprimé les cinq
-- index créés par 20260815220000_bibliotheque_recherche (lignes 50-54) sans
-- jamais les recréer. Or backend/src/modules/bibliotheque/recherche.service.ts
-- fait `recherche @@ to_tsquery` : la recherche plein texte s'appuyait donc
-- sur un balayage séquentiel de la table, et les similarités par trigrammes
-- sur le titre, le résumé et le texte extrait n'étaient plus indexées.
--
-- Les cinq index sont désormais déclarés dans schema.prisma — avec `map:`
-- pour conserver les noms d'origine — afin qu'un futur `migrate dev` ne les
-- supprime plus. `IF NOT EXISTS` rend le script rejouable sur une base où
-- ils existeraient déjà.
--
-- Contrôle avant déploiement (base de production) :
--
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'DocumentDepot' AND indexname LIKE '%trgm%';
--
-- Aucune modification de colonne : le trigger tsvector
-- "DocumentDepot_recherche_update" (20260815220000_bibliotheque_recherche)
-- reste en place et alimente la colonne "recherche".

-- Extension requise par les index trigrammes (gin_trgm_ops).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentDepot_recherche_idx" ON "DocumentDepot" USING GIN ("recherche");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentDepot_motsClefs_idx" ON "DocumentDepot" USING GIN ("motsClefs");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentDepot_contenuTexte_trgm" ON "DocumentDepot" USING GIN ("contenuTexte" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentDepot_titre_trgm" ON "DocumentDepot" USING GIN ("titre" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentDepot_resume_trgm" ON "DocumentDepot" USING GIN ("resume" gin_trgm_ops);
