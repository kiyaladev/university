-- Période de validité d'un créneau récurrent.
--
-- « Chaque lundi de 08h à 12h, du 1er au 31 janvier » : jusqu'ici un créneau
-- valait pour toute l'année, ce qui obligeait à le créer puis à le désactiver
-- à la main. Vides, les deux dates gardent l'ancien comportement.
ALTER TABLE "Creneau" ADD COLUMN "dateDebut" TIMESTAMP(3);
ALTER TABLE "Creneau" ADD COLUMN "dateFin" TIMESTAMP(3);
