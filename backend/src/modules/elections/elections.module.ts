import { Module } from '@nestjs/common';
import { ParametresModule } from '../parametres/parametres.module';
import { ElectionsController } from './elections.controller';
import { ElectionsService } from './elections.service';

/**
 * Plateforme d'élection des délégués et représentants.
 *
 * JwtModule local pour la route @Public() d'impression du bulletin à jeton
 * vérifié à la main (motif habituel).
 */
@Module({
  imports: [ParametresModule],
  controllers: [ElectionsController],
  providers: [ElectionsService],
  exports: [ElectionsService],
})
export class ElectionsModule {}
