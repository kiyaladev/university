import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ParametresModule } from '../parametres/parametres.module';
import { BadgesController } from './badges.controller';
import { BadgesService } from './badges.service';

/**
 * Badges d'accès visiteurs & intervenants.
 *
 * JwtModule local pour la route d'impression @Public() à jeton vérifié à la
 * main — même motif que les modules attestations / formations / rapports.
 */
@Module({
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [BadgesController],
  providers: [BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}