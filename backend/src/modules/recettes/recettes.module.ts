import { Module } from '@nestjs/common';
import { RecettesController } from './recettes.controller';
import { RecettesService } from './recettes.service';

/**
 * Module Recettes externes — régie des analyses labo, locations d'amphithéâtre,
 * prestations de formation / conseil. Une recette encaissée est rattachée à un
 * Paiement REUSSI (relation 1-1) ; le dashboard agrège par type et par mois
 * pour la direction.
 */
@Module({
  controllers: [RecettesController],
  providers: [RecettesService],
  exports: [RecettesService],
})
export class RecettesModule {}
