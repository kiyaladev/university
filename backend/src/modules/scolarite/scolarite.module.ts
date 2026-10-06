import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ParametresModule } from '../parametres/parametres.module';
import { DeliberationsController, EvaluationsController, NotesController } from './scolarite.controller';
import { ScolariteService } from './scolarite.service';

/** Scolarité LMD : évaluations, feuilles de notes et délibérations du jury. */
@Module({
  imports: [
    ParametresModule,
  ],
  controllers: [EvaluationsController, NotesController, DeliberationsController],
  providers: [ScolariteService],
  exports: [ScolariteService],
})
export class ScolariteModule {}