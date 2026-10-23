import { Module } from '@nestjs/common';
import { ParametresModule } from '../../socle/parametres/parametres.module';
import { AttestationsController } from './attestations.controller';
import { AttestationsService } from './attestations.service';

/**
 * Attestations officielles vérifiables par QR code. Le document A4 s'ouvre
 * dans un nouvel onglet sans en-tête Authorization : le jeton passe par l'URL
 * et la garde globale `@ProtectedDocument` le contrôle.
 */
@Module({
  imports: [ParametresModule],
  controllers: [AttestationsController],
  providers: [AttestationsService],
  exports: [AttestationsService],
})
export class AttestationsModule {}
