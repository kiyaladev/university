import { Module } from '@nestjs/common';
import { CreneauxService } from './creneaux.service';
import { SeancesService } from './seances.service';
import { CreneauxController, SeancesController } from './planification.controller';

@Module({
  controllers: [CreneauxController, SeancesController],
  providers: [CreneauxService, SeancesService],
  exports: [SeancesService, CreneauxService],
})
export class PlanificationModule {}
