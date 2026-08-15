import { Module } from '@nestjs/common';
import { UsersController, UsersService } from './users';
import { AnneesController, AnneesService } from './annees';
import {
  DepartementsController,
  DepartementsService,
  FilieresController,
  FilieresService,
  PromotionsController,
  PromotionsService,
} from './structure';
import { SallesController, SallesService } from './salles';
import { EnseignantsController, EnseignantsService } from './enseignants';
import { MatieresController, MatieresService } from './matieres';
import { AffectationsController, AffectationsService } from './affectations';

/** Toutes les données de référence : comptes, structure académique, salles,
 *  enseignants, matières et charges d'enseignement. */
@Module({
  controllers: [
    UsersController,
    AnneesController,
    DepartementsController,
    FilieresController,
    PromotionsController,
    SallesController,
    EnseignantsController,
    MatieresController,
    AffectationsController,
  ],
  providers: [
    UsersService,
    AnneesService,
    DepartementsService,
    FilieresService,
    PromotionsService,
    SallesService,
    EnseignantsService,
    MatieresService,
    AffectationsService,
  ],
  exports: [AnneesService, SallesService, EnseignantsService, AffectationsService],
})
export class ReferentielModule {}
