/**
 * Module 1 — Inscriptions en ligne & paiement Mobile Money.
 *
 * Le candidat dépose son dossier sans compte : un étudiant naît au registre
 * (matricule INE + QR resto), son inscription court en EN_ATTENTE_PAIEMENT,
 * le paiement Mobile Money est demandé, l'agent comptable ou le DAF confirme
 * (mode pilote : rien n'atteint l'opérateur sans MOBILE_MONEY_URL), puis la
 * scolarité valide. La base des étudiants alimente tous les autres modules.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ParametresModule } from '../parametres/parametres.module';
import {
  EtudiantsController,
  FraisController,
  InscriptionPubliqueController,
  InscriptionsController,
  PaiementsController,
} from './inscription.controller';
import { EtudiantsService } from './etudiants.service';
import { FraisService, InscriptionService } from './inscription.service';
import { MobileMoneyService } from './mobile-money.service';

@Module({
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [
    InscriptionPubliqueController,
    EtudiantsController,
    FraisController,
    PaiementsController,
    InscriptionsController,
  ],
  providers: [InscriptionService, EtudiantsService, FraisService, MobileMoneyService],
  exports: [],
})
export class InscriptionModule {}