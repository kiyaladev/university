import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ParametresModule } from '../parametres/parametres.module';
import { AttestationsController } from './attestations.controller';
import { AttestationsService } from './attestations.service';

/**
 * Attestations officielles vérifiables par QR code. Le JwtModule est déclaré
 * ici (même motif que modules/rapports) : le document A4 s'ouvre dans un
 * nouvel onglet sans en-tête Authorization, le jeton passe par l'URL et est
 * vérifié à la main dans le service.
 */
@Module({
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [AttestationsController],
  providers: [AttestationsService],
  exports: [AttestationsService],
})
export class AttestationsModule {}