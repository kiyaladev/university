/**
 * Suivi des stages & mémoires : sujet proposé → validé → encadré → rapport
 * rendu → soutenu. Triple partie (étudiant, encadrant, tuteur en entreprise)
 * tenue par la scolarité et la direction ; l'enseignant ne voit que ses
 * encadrements, l'étudiant que ses travaux (via le portail).
 */
import { Module } from '@nestjs/common';
import { ParametresModule } from '../parametres/parametres.module';
import { FicheService } from './fiche.service';
import { SoutenancesController, TravauxEncadresController } from './stages.controller';
import { StagesService } from './stages.service';

/**
 * La fiche A4 s'ouvre dans un nouvel onglet sans en-tête Authorization : le
 * jeton passe par l'URL et la garde globale `@ProtectedDocument` le contrôle
 * avant l'appel à FicheService.
 */
@Module({
  imports: [ParametresModule],
  controllers: [TravauxEncadresController, SoutenancesController],
  providers: [StagesService, FicheService],
  exports: [StagesService],
})
export class StagesModule {}
