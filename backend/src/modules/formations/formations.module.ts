/**
 * Hub de formation continue & certifications (recettes propres).
 *
 * Vitrine publique des formations payantes : n'importe qui s'inscrit sans
 * compte, paie par Mobile Money (simulation en pilote — la scolarité ou la
 * direction confirme l'encaissement au guichet), et reçoit son attestation
 * une fois la formation réglée. Les paiements de ce module sont écrits
 * directement par FormationsService (références PAY-F-AAAA) : le pipeline
 * /api/paiements exige un compte connecté, la vitrine n'en a pas.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ParametresModule } from '../parametres/parametres.module';
import { FormationsController } from './formations.controller';
import { FormationsService } from './formations.service';

@Module({
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [FormationsController],
  providers: [FormationsService],
  exports: [FormationsService],
})
export class FormationsModule {}