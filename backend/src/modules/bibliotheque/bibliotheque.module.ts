import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BibliothequeController } from './bibliotheque.controller';
import { BibliothequeService } from './bibliotheque.service';

/**
 * Dépôt institutionnel & bibliothèque numérique. Le JwtModule est déclaré ici
 * (même motif que modules/rapports) : la liste et le téléchargement restent des
 * routes @Public() mais le jeton est vérifié à la main pour distinguer le
 * staff du visiteur anonyme.
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [BibliothequeController],
  providers: [BibliothequeService],
  exports: [BibliothequeService],
})
export class BibliothequeModule {}
