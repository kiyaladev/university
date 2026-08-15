import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [PaieController],
  providers: [PaieService],
  exports: [PaieService],
})
export class PaieModule {}