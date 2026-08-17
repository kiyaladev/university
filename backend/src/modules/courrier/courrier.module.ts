import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CourrierController } from './courrier.controller';
import { CourrierService } from './courrier.service';

/**
 * Module Courrier — enregistrement et circulation des courriers administratifs.
 * Cycle de vie : RECU → ENREGISTRE → EN_CIRCUIT → TRAITE → CLASSE → ARCHIVE.
 * Le circuit de paraphe est multi-étapes (rôles : secrétariat → chef → archives,
 * ou tout autre circuit fourni à la création).
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [CourrierController],
  providers: [CourrierService],
  exports: [CourrierService],
})
export class CourrierModule {}
