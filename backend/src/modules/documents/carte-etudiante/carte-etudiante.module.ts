import { Module } from '@nestjs/common';
import { ParametresModule } from '../../socle/parametres/parametres.module';
import { CarteEtudianteController } from './carte-etudiante.controller';
import { CarteEtudianteService } from './carte-etudiante.service';

/**
 * Carte d'étudiant numérique.
 *
 * L'impression A4 s'ouvre dans un nouvel onglet sans en-tête Authorization :
 * le jeton passe par l'URL et la garde globale `@ProtectedDocument` le
 * contrôle — même motif que les modules rapports, formations, attestations.
 */
@Module({
  imports: [ParametresModule],
  controllers: [CarteEtudianteController],
  providers: [CarteEtudianteService],
  exports: [CarteEtudianteService],
})
export class CarteEtudianteModule {}
