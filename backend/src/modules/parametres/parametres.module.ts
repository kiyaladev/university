import { Module } from '@nestjs/common';
import { ParametresController } from './parametres.controller';
import { ParametresService } from './parametres.service';
import { ServicesActifsController } from './services-actifs.controller';
import { ServicesActifsGuard } from './services-actifs.guard';
import { ServicesActifsService } from './services-actifs.service';

/**
 * Paramètres de l'établissement, y compris l'activation des services
 * (clés SERVICE_ACTIF_* de la même table `Parametre`). Les routes restent
 * /parametres et /services-actifs ; la garde est exportée pour APP_GUARD.
 */
@Module({
  controllers: [ParametresController, ServicesActifsController],
  providers: [ParametresService, ServicesActifsService, ServicesActifsGuard],
  exports: [ParametresService, ServicesActifsGuard],
})
export class ParametresModule {}
