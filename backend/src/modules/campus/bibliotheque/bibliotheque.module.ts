import { AuthModule } from '../../socle/auth/auth.module';
import { Module } from '@nestjs/common';
import { BibliothequeController } from './bibliotheque.controller';
import { BibliothequeService } from './bibliotheque.service';
import { PlagiatService } from './plagiat.service';
import { RechercheService } from './recherche.service';

/**
 * Dépôt institutionnel & bibliothèque numérique. AuthModule fournit le
 * JwtService utilisé pour distinguer le staff du visiteur anonyme sur les
 * routes publiques à jeton optionnel.
 *
 * Étendu avec :
 *  - RechercheService (FTS PostgreSQL) ;
 *  - PlagiatService (extraction PDF + empreinte SHA-256 + détection de
 *    doublons + tableau de bord + acquittement humain).
 */
@Module({
  imports: [AuthModule],
  controllers: [BibliothequeController],
  providers: [BibliothequeService, RechercheService, PlagiatService],
  exports: [BibliothequeService, RechercheService, PlagiatService],
})
export class BibliothequeModule {}
