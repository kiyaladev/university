/**
 * Module 1 — Inscriptions en ligne & paiement Mobile Money.
 * Routes ouvertes (préinscription, impression jeton), registres d'étudiants,
 * tarifs, paiements et cycle de vie des dossiers.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import {
  AnnulerPaiementDto,
  CreateEtudiantDto,
  CreateFraisDto,
  CreateInscriptionDto,
  CreatePaiementDto,
  EtudiantQueryDto,
  FraisQueryDto,
  InscriptionPubliqueDto,
  InscriptionQueryDto,
  PaiementQueryDto,
  SimulerPaiementDto,
  UpdateEtudiantDto,
  UpdateFraisDto,
} from './inscription.dto';
import { EtudiantsService } from './etudiants.service';
import { FraisService, InscriptionService } from './inscription.service';

@ApiTags('Inscription publique')
@Controller('inscription-publique')
export class InscriptionPubliqueController {
  constructor(private readonly service: InscriptionService) {}

  /**
   * Dépôt du dossier sans compte : 10 dépôts par minute et par adresse
   * (champ programmeur, tolérant — modéré par le throttler « courant »).
   */
  @Public()
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
    courant: { limit: 10, ttl: 60_000 },
  })
  @Post()
  deposer(@Body() dto: InscriptionPubliqueDto, @Ip() ip: string) {
    return this.service.depotPublic(dto, ip);
  }

  @Public()
  @Get('annees')
  annees() {
    return this.service.anneesOuvertes();
  }

  @Public()
  @Get('annees/:anneeId/promotions')
  promotions(@Param('anneeId') anneeId: string) {
    return this.service.promotionsOuvertes(anneeId);
  }
}

@ApiTags('Étudiants')
@ApiBearerAuth()
@Controller('etudiants')
export class EtudiantsController {
  constructor(private readonly service: EtudiantsService) {}

  @Get()
  liste(@Query() query: EtudiantQueryDto) {
    const actif =
      query.actif === 'false' || query.actif === '0' ? false : query.actif ? true : undefined;
    return this.service.findAll(query, {
      ...(actif !== undefined ? { actif } : {}),
    });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Post()
  creer(@Body() dto: CreateEtudiantDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateEtudiantDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  /** Réservé à l'administration ; la fiche se désactive, elle ne s'efface pas. */
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}

@ApiTags('Frais d’inscription')
@ApiBearerAuth()
@Controller('frais')
export class FraisController {
  constructor(private readonly service: FraisService) {}

  @Get()
  liste(@Query() query: FraisQueryDto) {
    return this.service.findAll(query, {
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.promotionId ? { promotionId: query.promotionId } : {}),
    });
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post()
  creer(@Body() dto: CreateFraisDto, @CurrentUser() user: AuthUser) {
    return this.service.creerFrais(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateFraisDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifierFrais(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimerFrais(id, user);
  }
}

@ApiTags('Paiements')
@ApiBearerAuth()
@Controller('paiements')
export class PaiementsController {
  constructor(private readonly service: InscriptionService) {}

  @Get()
  liste(@Query() query: PaiementQueryDto) {
    return this.service.listePaiements(query);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Post()
  creer(@Body() dto: CreatePaiementDto, @CurrentUser() user: AuthUser) {
    return this.service.creerPaiement(dto, user);
  }

  /**
   * Confirmation pilote de l'agent comptable / du DAF : la réponse de
   * l'opérateur (ou du guichet) répercute le statut REUSSI / ECHOUE.
   */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post(':id/simuler')
  simuler(
    @Param('id') id: string,
    @Body() dto: SimulerPaiementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.simulerPaiement(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post(':id/annuler')
  annuler(
    @Param('id') id: string,
    @Body() dto: AnnulerPaiementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.annulerPaiement(id, dto, user);
  }
}

@ApiTags('Inscriptions')
@ApiBearerAuth()
@Controller('inscriptions')
export class InscriptionsController {
  constructor(
    private readonly service: InscriptionService,
    private readonly jwt: JwtService,
  ) {}

  @Get()
  liste(@Query() query: InscriptionQueryDto) {
    return this.service.listeInscriptions(query);
  }

  /** Dossier ouvert au guichet (étudiant déjà fiché). */
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Post()
  creer(@Body() dto: CreateInscriptionDto, @CurrentUser() user: AuthUser) {
    return this.service.creerInscription(dto, user);
  }

  /** PAYEE → VALIDEE : décision de la scolarité. */
  @Roles(Role.SCOLARITE, Role.ADMIN)
  @Put(':id/valider')
  valider(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.validerInscription(id, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Put(':id/annuler')
  annuler(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.annulerInscription(id, user);
  }

  /**
   * Certificat A4 ouvert dans un nouvel onglet : le jeton passe en paramètre
   * d'URL (pas d'en-tête Authorization possible) et est vérifié ici même,
   * comme /feuilles-paie/:id/imprimer.
   */
  @Public()
  @Get(':id/attestation-inscription')
  async attestation(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    try {
      this.jwt.verify(token ?? '', {
        secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      });
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
    res.type('html').send(await this.service.attestationInscription(id));
  }
}