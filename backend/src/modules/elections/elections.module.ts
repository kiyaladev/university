import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ParametresModule } from '../parametres/parametres.module';
import { ElectionsController } from './elections.controller';
import { ElectionsService } from './elections.service';

/**
 * Plateforme d'élection des délégués et représentants.
 *
 * JwtModule local pour la route @Public() d'impression du bulletin à jeton
 * vérifié à la main (motif habituel).
 */
@Module({
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [ElectionsController],
  providers: [ElectionsService],
  exports: [ElectionsService],
})
export class ElectionsModule {}