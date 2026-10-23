import { Module } from '@nestjs/common';
import { ParametresModule } from '../parametres/parametres.module';
import { CarteEtudianteController } from './carte-etudiante.controller';
import { CarteEtudianteService } from './carte-etudiante.service';

/**
 * Carte d'étudiant numérique.
 *
 * Le module embarque son propre JwtModule pour les routes @Public() à jeton
 * vérifié à la main (impression A4) — même motif que les modules rapports,
 * formations, attestations.
 */
@Module({
  imports: [
    ParametresModule,
  ],
  controllers: [CarteEtudianteController],
  providers: [CarteEtudianteService],
  exports: [CarteEtudianteService],
})
export class CarteEtudianteModule {}