/**
 * Tableau de bord du Rectorat — agrégats en direct pour la direction et
 * l'administration, snapshots MESRS pour la transmission ministérielle.
 *
 * Les chiffres sont calculés à la volée : effectif, taux de réussite, masse
 * salariale du mois, réclamations et tickets helpdesk. Le snapshot MESRS est
 * l'archive figée qu'on transmet au ministère — un cron quotidien l'écrit en
 * base, mais l'admin peut le forcer à la demande.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RectoratController } from './rectorat.controller';
import { RectoratService } from './rectorat.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [RectoratController],
  providers: [RectoratService],
  exports: [RectoratService],
})
export class RectoratModule {}
