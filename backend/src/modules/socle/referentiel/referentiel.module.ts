import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AnneesController } from './annees.controller';
import { AnneesService } from './annees.service';
import { DepartementsController } from './departements.controller';
import { DepartementsService } from './departements.service';
import { FilieresController } from './filieres.controller';
import { FilieresService } from './filieres.service';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { SallesController } from './salles.controller';
import { SallesService } from './salles.service';
import { EnseignantsController } from './enseignants.controller';
import { EnseignantsService } from './enseignants.service';
import { MatieresController } from './matieres.controller';
import { MatieresService } from './matieres.service';
import { AffectationsController } from './affectations.controller';
import { AffectationsService } from './affectations.service';

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
  exports: [AnneesService, SallesService, EnseignantsService, MatieresService, AffectationsService],
})
export class ReferentielModule {}
