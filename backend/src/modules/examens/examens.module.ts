import { Module } from '@nestjs/common';
import { ExamensController } from './examens.controller';
import { ExamensService } from './examens.service';

/**
 * Module Examens — planification, scan anti-fantômes et suivi des présences.
 * Cycle de vie : PLANIFIE → EN_COURS → TERMINE (ou ANNULE).
 */
@Module({
  controllers: [ExamensController],
  providers: [ExamensService],
  exports: [ExamensService],
})
export class ExamensModule {}
