/**
 * Module 1 — Inscriptions en ligne & paiement Mobile Money.
 *
 * Le candidat dépose son dossier sans compte : un étudiant naît au registre
 * (matricule INE + QR resto), son inscription court en EN_ATTENTE_PAIEMENT,
 * le paiement Mobile Money est demandé, l'agent comptable ou le DAF confirme
 * (mode pilote : rien n'atteint l'opérateur sans MOBILE_MONEY_URL), puis la
 * scolarité valide. La base des étudiants alimente tous les autres modules.
 */
import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';
import { ParametresModule } from '../parametres/parametres.module';
import {
  EtudiantsController,
  FraisController,
  InscriptionPubliqueController,
  InscriptionsController,
  PaiementsController,
} from './inscription.controller';
import { EtudiantsService } from './etudiants.service';
import { FraisService } from './frais.service';
import { InscriptionService } from './inscription.service';
import { PaiementsService } from './paiements.service';
import { MobileMoneyModule } from './mobile-money.module';

@Module({
  imports: [AuthModule, ParametresModule, MobileMoneyModule],
  controllers: [
    InscriptionPubliqueController,
    EtudiantsController,
    FraisController,
    PaiementsController,
    InscriptionsController,
  ],
  providers: [InscriptionService, EtudiantsService, FraisService, PaiementsService],
  exports: [],
})
export class InscriptionModule {}
