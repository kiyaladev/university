import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BibliothequeController } from './bibliotheque.controller';
import { BibliothequeService } from './bibliotheque.service';
import { PlagiatService } from './plagiat.service';
import { RechercheService } from './recherche.service';

/**
 * Dépôt institutionnel & bibliothèque numérique. Le JwtModule est déclaré ici
 * (même motif que modules/rapports) : la liste et le téléchargement restent des
 * routes @Public() mais le jeton est vérifié à la main pour distinguer le
 * staff du visiteur anonyme.
 *
 * Étendu avec :
 *  - RechercheService (FTS PostgreSQL) ;
 *  - PlagiatService (extraction PDF + empreinte SHA-256 + détection de
 *    doublons + tableau de bord + acquittement humain).
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [BibliothequeController],
  providers: [BibliothequeService, RechercheService, PlagiatService],
  exports: [BibliothequeService, RechercheService, PlagiatService],
})
export class BibliothequeModule {}
