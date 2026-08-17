import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [CarteEtudianteController],
  providers: [CarteEtudianteService],
  exports: [CarteEtudianteService],
})
export class CarteEtudianteModule {}