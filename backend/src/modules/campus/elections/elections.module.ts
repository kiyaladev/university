import { Module } from '@nestjs/common';
import { ParametresModule } from '../../socle/parametres/parametres.module';
import { ElectionsController } from './elections.controller';
import { ElectionsService } from './elections.service';

/**
 * Plateforme d'élection des délégués et représentants.
 *
 * L'impression du bulletin s'ouvre dans un nouvel onglet sans en-tête
 * Authorization : le jeton passe par l'URL et la garde globale
 * `@ProtectedDocument` le contrôle (motif habituel).
 */
@Module({
  imports: [ParametresModule],
  controllers: [ElectionsController],
  providers: [ElectionsService],
  exports: [ElectionsService],
})
export class ElectionsModule {}
