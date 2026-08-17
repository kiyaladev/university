import { Module } from '@nestjs/common';
import { VodController } from './vod.controller';
import { VodService } from './vod.service';

/**
 * Plateforme VOD des cours.
 *
 * Pas de JwtModule local ni de ParametresModule : aucune route n'est @Public()
 * à jeton vérifié à la main. L'impression d'attestations se fait côté
 * rapports / attestations.
 */
@Module({
  controllers: [VodController],
  providers: [VodService],
  exports: [VodService],
})
export class VodModule {}