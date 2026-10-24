/**
 * Module 1 — Inscriptions en ligne & paiement Mobile Money.
 * Routes ouvertes (préinscription, impression jeton), registres d'étudiants,
 * tarifs, paiements et cycle de vie des dossiers.
 */
import { Body, Controller, Delete, Get, Ip, NotFoundException, Param, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { t } from '../../../common/i18n';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles, ProtectedDocument, DocumentScope } from '../../../common/decorators';
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
import { whereEtudiants } from './filtres';
import { FraisService } from './frais.service';
import { InscriptionService } from './inscription.service';
import { PaiementsService } from './paiements.service';

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
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.CHEF_DEPARTEMENT, Role.ETUDIANT, Role.ENSEIGNANT)
export class EtudiantsController {
  constructor(private readonly service: EtudiantsService) {}

  @Get()
  lister(@Query() query: EtudiantQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listePour(
      query,
      {
        ...(user.role === Role.ETUDIANT ? { id: user.etudiantId ?? '__aucun__' } : {}),
        ...whereEtudiants(query),
      },
      user,
    );
  }

  @Get(':id')
  lire(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (user.role === Role.ETUDIANT && id !== user.etudiantId) throw new NotFoundException(t('common.notFound'));
    return this.service.detailPour(id, user);
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
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}

@ApiTags('Frais d’inscription')
@ApiBearerAuth()
@Controller('frais')
export class FraisController {
  constructor(private readonly service: FraisService) {}

  @Public()
  @Get()
  lister(@Query() query: FraisQueryDto) {
    return this.service.tarifsPublics(query, {
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.promotionId ? { promotionId: query.promotionId } : {}),
    });
  }

  /**
   * Grille de gestion des tarifs : l'année et la promotion de chaque tarif,
   * que la lecture publique ne montre pas.
   */
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Get('gestion')
  listeGestion(@Query() query: FraisQueryDto) {
    return this.service.tarifsGestion(query, {
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
  modifier(@Param('id') id: string, @Body() dto: UpdateFraisDto, @CurrentUser() user: AuthUser) {
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
  constructor(private readonly service: PaiementsService) {}

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Get()
  lister(@Query() query: PaiementQueryDto) {
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
  simuler(@Param('id') id: string, @Body() dto: SimulerPaiementDto, @CurrentUser() user: AuthUser) {
    return this.service.simulerPaiement(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post(':id/annuler')
  annuler(@Param('id') id: string, @Body() dto: AnnulerPaiementDto, @CurrentUser() user: AuthUser) {
    return this.service.annulerPaiement(id, dto, user);
  }
}

@ApiTags('Inscriptions')
@ApiBearerAuth()
@Controller('inscriptions')
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.CHEF_DEPARTEMENT, Role.ETUDIANT)
export class InscriptionsController {
  constructor(private readonly service: InscriptionService) {}

  @Get()
  lister(@Query() query: InscriptionQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listeInscriptions(query, user);
  }

  /** Dossier ouvert au guichet (étudiant déjà fiché). */
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Post()
  creer(@Body() dto: CreateInscriptionDto, @CurrentUser() user: AuthUser) {
    return this.service.creerInscription(dto, user);
  }

  /** PAYE → VALIDE : décision de la scolarité. */
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
   * d'URL (pas d'en-tête Authorization possible). La garde globale
   * `@ProtectedDocument` le contrôle — signature, activité du compte et
   * révocation des sessions — puis les rôles sont filtrés par le décorateur.
   */
  @ProtectedDocument(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.CHEF_DEPARTEMENT, Role.ETUDIANT)
  @DocumentScope('inscription', {
    [Role.ETUDIANT]: 'etudiantId',
    [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId',
  })
  @Get(':id/attestation-inscription')
  async attestation(@Param('id') id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    await this.service.trouverInscription(id, user);
    res.type('html').send(await this.service.attestationInscription(id));
  }

  /**
   * Détail d'un dossier. Déclarée en dernier pour que le segment `:id` ne
   * capture pas les routes littérales déclarées au-dessus. Même périmètre que
   * la liste (l’étudiant reste limité à son propre dossier) : sans elle, le préchargement du
   * libellé par identifiant côté client échouait en silence.
   */
  @Get(':id')
  lire(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.trouverInscription(id, user);
  }
}
