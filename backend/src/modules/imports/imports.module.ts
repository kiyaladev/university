import { Module } from '@nestjs/common';
import { PlanificationModule } from '../planification/planification.module';
import { ReferentielModule } from '../referentiel/referentiel.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [ReferentielModule, PlanificationModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
