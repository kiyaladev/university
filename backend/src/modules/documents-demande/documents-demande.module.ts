import { Module } from '@nestjs/common';
import { DocumentsDemandeController } from './documents-demande.controller';
import { DocumentsDemandeService } from './documents-demande.service';
import { MobileMoneyModule } from '../inscription/mobile-money.module';
import { AttestationsModule } from '../attestations/attestations.module';

/**
 * Plateforme de demande de documents en ligne : l'étudiant formule une
 * demande, paie au tarif paramétré, la scolarité traite, marque le document
 * comme prêt et le remet au guichet. Le JwtModule est déclaré ici (même
 * motif que modules/attestations) : la feuille A4 s'ouvre dans un nouvel
 * onglet sans en-tête Authorization, le jeton passe par l'URL et est vérifié
 * à la main dans le service.
 */
@Module({
  imports: [
    MobileMoneyModule,
    AttestationsModule,
  ],
  controllers: [DocumentsDemandeController],
  providers: [DocumentsDemandeService],
  exports: [DocumentsDemandeService],
})
export class DocumentsDemandeModule {}
