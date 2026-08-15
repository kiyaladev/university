/**
 * Support IT & helpdesk campus : QR sur les équipements, déclaration en deux
 * clics, file de tickets pour la DSI. Le JwtModule est déclaré ici (même motif
 * que modules/attestations) : la feuille d'étiquettes s'ouvre dans un nouvel
 * onglet sans en-tête Authorization, le jeton passe par l'URL et est vérifié
 * à la main dans le service.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ParametresModule } from '../parametres/parametres.module';
import { EquipementsController, TicketsController } from './helpdesk.controller';
import { EquipementsService, TicketsService } from './helpdesk.service';

@Module({
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [EquipementsController, TicketsController],
  providers: [EquipementsService, TicketsService],
  exports: [EquipementsService, TicketsService],
})
export class HelpdeskModule {}