import { Module } from '@nestjs/common';
import { ParametresModule } from '../parametres/parametres.module';
import { PaieController } from './paie.controller';
import { PaieService } from './paie.service';

/**
 * Module 2 — Gestion des vacataires & paie des heures complémentaires.
 *
 * Feuilles de paie mensuelles (BROUILLON → VALIDEE → PAYEE) calculées depuis
 * les séances contrôlées d'UniPrésence, avec impression A4 signée.
 */
@Module({
  imports: [ParametresModule],
  controllers: [PaieController],
  providers: [PaieService],
  exports: [PaieService],
})
export class PaieModule {}
