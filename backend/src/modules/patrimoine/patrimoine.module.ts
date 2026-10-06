/**
 * Patrimoine & matériel pédagogique — module de gestion.
 *
 * Inventaire des équipements de l'université (vidéoprojecteurs, micros,
 * ordinateurs, mobilier…) avec QR code d'inventaire, suivi des catégories
 * et journal des réparations. Le QR encode un jeton « UP-PAT-<base64url> »
 * qui résout l'équipement en mode public (utile aux scans terrain).
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PatrimoineController } from './patrimoine.controller';
import { PatrimoineService } from './patrimoine.service';

@Module({
  imports: [
  ],
  controllers: [PatrimoineController],
  providers: [PatrimoineService],
  exports: [PatrimoineService],
})
export class PatrimoineModule {}
