/**
 * Support IT & helpdesk campus : QR sur les équipements, déclaration en deux
 * clics, file de tickets pour la DSI. Le JwtModule est déclaré ici (même motif
 * que modules/attestations) : la feuille d'étiquettes s'ouvre dans un nouvel
 * onglet sans en-tête Authorization, le jeton passe par l'URL et est vérifié
 * à la main dans le service.
 */
import { Module } from '@nestjs/common';
import { ParametresModule } from '../parametres/parametres.module';
import { EquipementsController, TicketsController } from './helpdesk.controller';
import { EquipementsService, TicketsService } from './helpdesk.service';

@Module({
  imports: [
    ParametresModule,
  ],
  controllers: [EquipementsController, TicketsController],
  providers: [EquipementsService, TicketsService],
  exports: [EquipementsService, TicketsService],
})
export class HelpdeskModule {}