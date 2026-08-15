/**
 * Module C — Titres resto numériques & canteen wallet.
 *
 * Le JwtModule est déclaré ici (même motif que modules/attestations) : les
 * routes du poste de guichet sont publiques et le jeton, passant par l'URL ou
 * l'en-tête, est vérifié à la main dans le service.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ParametresModule } from '../parametres/parametres.module';
import { PortailRestoController, RestoController } from './resto.controller';
import { RestoService } from './resto.service';

@Module({
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [RestoController, PortailRestoController],
  providers: [RestoService],
  exports: [RestoService],
})
export class RestoModule {}