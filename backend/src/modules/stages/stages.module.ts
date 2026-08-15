/**
 * Suivi des stages & mémoires : sujet proposé → validé → encadré → rapport
 * rendu → soutenu. Triple partie (étudiant, encadrant, tuteur en entreprise)
 * tenue par la scolarité et la direction ; l'enseignant ne voit que ses
 * encadrements, l'étudiant que ses travaux (via le portail).
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ParametresModule } from '../parametres/parametres.module';
import { FicheService } from './fiche.service';
import { SoutenancesController, TravauxEncadresController } from './stages.controller';
import { StagesService } from './stages.service';

/**
 * Le JwtModule est déclaré ici (même motif que modules/attestations) : la
 * fiche A4 s'ouvre dans un nouvel onglet sans en-tête Authorization, le jeton
 * passe par l'URL et est vérifié à la main dans FicheService.
 */
@Module({
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [TravauxEncadresController, SoutenancesController],
  providers: [StagesService, FicheService],
  exports: [StagesService],
})
export class StagesModule {}