import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DocumentsDemandeController } from './documents-demande.controller';
import { DocumentsDemandeService } from './documents-demande.service';

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
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [DocumentsDemandeController],
  providers: [DocumentsDemandeService],
  exports: [DocumentsDemandeService],
})
export class DocumentsDemandeModule {}