import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TirageController } from './tirage.controller';
import { TirageService } from './tirage.service';

/**
 * Module Tirage — tirage et distribution sécurisée des épreuves.
 *
 * Cycle de vie : PROGRAMME → IMPRIME → MIS_SOUS_PLI → DISTRIBUE → RECUPERE
 * (ou ANNULE depuis PROGRAMME). Chaque transition est gardée par le service.
 *
 * L'empreinte SHA-256 du fichier source, fournie à la création, est
 * re-vérifiée au moment de l'impression : c'est le verrou anti-substitution
 * du module (toute version corrompue est refusée).
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [TirageController],
  providers: [TirageService],
  exports: [TirageService],
})
export class TirageModule {}
