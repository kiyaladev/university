/**
 * Module C — Titres resto numériques & canteen wallet.
 *
 * Les routes du poste de guichet sont publiques : le jeton, passant par l'URL
 * ou l'en-tête, est résolu par la garde globale (`@AuthentificationOptionnelle`)
 * et le rôle de guichet est contrôlé dans le service.
 */
import { Module } from '@nestjs/common';
import { ParametresModule } from '../../socle/parametres/parametres.module';
import { PortailRestoController, RestoController } from './resto.controller';
import { RestoService } from './resto.service';

@Module({
  imports: [ParametresModule],
  controllers: [RestoController, PortailRestoController],
  providers: [RestoService],
  exports: [RestoService],
})
export class RestoModule {}
