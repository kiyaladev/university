import { Module } from '@nestjs/common';
import { ParametresModule } from '../../socle/parametres/parametres.module';
import { RapportsService } from './rapports.service';
import { ImpressionService } from './impression.service';
import { ExportService } from './export.service';
import { RapportsController } from './rapports.controller';
import { ImpressionController } from './impression.controller';
import { ExportController } from './export.controller';
import { CouvertureControleursController } from './couverture-controleurs.controller';
import { ReleveHebdomadaireController } from './releve-pdf.controller';
import { RelevePdfService } from './releve-pdf.service';

@Module({
  imports: [ParametresModule],
  controllers: [
    RapportsController,
    ImpressionController,
    ExportController,
    ReleveHebdomadaireController,
    CouvertureControleursController,
  ],
  providers: [RapportsService, ImpressionService, ExportService, RelevePdfService],
  exports: [RapportsService],
})
export class RapportsModule {}
