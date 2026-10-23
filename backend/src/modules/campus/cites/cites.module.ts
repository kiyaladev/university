/**
 * Module A — Cités universitaires & logements.
 *
 * Attribution transparente des chambres (score social/mérite, jury), suivi
 * du parc (résidences → chambres → attributions) et lecture des loyers pour
 * la future facturation Mobile Money (réutilise le module paiement existant,
 * sans raccordement ici).
 */
import { Module } from '@nestjs/common';
import { AttributionsController, ChambresController, ResidencesController } from './cites.controller';
import { AttributionsService, ChambresService, ResidencesService } from './cites.service';

@Module({
  imports: [],
  controllers: [ResidencesController, ChambresController, AttributionsController],
  providers: [ResidencesService, ChambresService, AttributionsService],
  exports: [ResidencesService, ChambresService, AttributionsService],
})
export class CitesModule {}
