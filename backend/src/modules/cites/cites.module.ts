/**
 * Module A — Cités universitaires & logements.
 *
 * Attribution transparente des chambres (score social/mérite, jury), suivi
 * du parc (résidences → chambres → attributions) et lecture des loyers pour
 * la future facturation Mobile Money (réutilise le module paiement existant,
 * sans raccordement ici).
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  AttributionsController,
  ChambresController,
  ResidencesController,
} from './cites.controller';
import { AttributionsService, ChambresService, ResidencesService } from './cites.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [ResidencesController, ChambresController, AttributionsController],
  providers: [ResidencesService, ChambresService, AttributionsService],
  exports: [ResidencesService, ChambresService, AttributionsService],
})
export class CitesModule {}