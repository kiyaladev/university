import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ParametresModule } from '../parametres/parametres.module';
import { DeliberationsController, EvaluationsController, NotesController } from './scolarite.controller';
import { ScolariteService } from './scolarite.service';

/** Scolarité LMD : évaluations, feuilles de notes et délibérations du jury. */
@Module({
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [EvaluationsController, NotesController, DeliberationsController],
  providers: [ScolariteService],
  exports: [ScolariteService],
})
export class ScolariteModule {}