import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { RestoService } from './resto.service';
import {
  AnnulerConsommationDto,
  ConsommationsQueryDto,
  PortefeuillesQueryDto,
  RechargerPortailDto,
  RechargerPortefeuilleDto,
  RechargesQueryDto,
  SimulerRechargeDto,
  ValiderRepasDto,
} from './resto.dto';

/** Administration du module : administration, direction des études, scolarité. */
const GESTIONNAIRES = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE];

@ApiTags('Resto — portefeuille & cantine')
@ApiBearerAuth()
@Controller('resto')
export class RestoController {
  constructor(private readonly service: RestoService) {}

  // ------------------------------------------------------------- consultation

  @Roles(...GESTIONNAIRES)
  @Get('portefeuilles')
  portefeuilles(@Query() query: PortefeuillesQueryDto) {
    return this.service.listePortefeuilles(query);
  }

  /**
   * Le portefeuille de l'étudiant connecté (portail). Déclaré avant
   * `portefeuille/:etudiantId` pour que le mot « me » ne soit pas capturé
   * comme identifiant.
   */
  @Roles(Role.ETUDIANT)
  @Get('portefeuille/me')
  monPortefeuille(@CurrentUser() user: AuthUser) {
    return this.service.monPortefeuille(user);
  }

  @Roles(...GESTIONNAIRES)
  @Get('portefeuille/:etudiantId')
  detail(@Param('etudiantId') etudiantId: string) {
    return this.service.detailPortefeuille(etudiantId);
  }

  @Roles(...GESTIONNAIRES)
  @Get('consommations')
  consommations(@Query() query: ConsommationsQueryDto) {
    return this.service.listeConsommations(query);
  }

  @Roles(...GESTIONNAIRES)
  @Get('recharges')
  recharges(@Query() query: RechargesQueryDto) {
    return this.service.listeRecharges(query);
  }

  // -------------------------------------------------------- gestion (caisse)

  @Roles(...GESTIONNAIRES)
  @Post('portefeuilles/:id/recharger')
  recharger(
    @Param('id') id: string,
    @Body() dto: RechargerPortefeuilleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recharger(id, dto, user);
  }

  @Roles(...GESTIONNAIRES)
  @Post('recharges/:id/simuler')
  simulerRecharge(
    @Param('id') id: string,
    @Body() dto: SimulerRechargeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.simulerRecharge(id, dto, user);
  }

  @Roles(...GESTIONNAIRES)
  @Post('consommations/:id/annuler')
  annuler(
    @Param('id') id: string,
    @Body() dto: AnnulerConsommationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.annulerConsommation(id, dto, user);
  }

  // ------------------------------------------------------------- poste guichet
  // Routes @Public : l'appareil du cantinier lit le jeton en en-tête (interface)
  // ou en paramètre d'URL (fin de session, imprimante) ; le service le vérifie
  // à la main — pattern identique à `attestations/:id/imprimer`.

  @Public()
  @Get('carte/:reference')
  carte(@Param('reference') reference: string, @Req() req: Request) {
    return this.service.carteInfo(reference, jetonDe(req));
  }

  @Public()
  @Post('valider')
  valider(@Body() dto: ValiderRepasDto, @Req() req: Request) {
    return this.service.validerRepas(dto, jetonDe(req));
  }
}

/** Le jeton du poste de guichet : en-tête Authorization puis paramètre `token`. */
function jetonDe(req: Request): string | undefined {
  const enTete = req.headers.authorization;
  if (enTete?.startsWith('Bearer ')) return enTete.slice(7);
  const token = req.query.token;
  return typeof token === 'string' ? token : undefined;
}

/**
 * Espace étudiant : le portefeuille vit dans le module resto, mais les routes
 * exposées au portail sont groupées sous /portail/resto pour ne pas mélanger
 * les responsabilités (ce que voit l'étudiant ≠ ce que voit le guichet).
 */
@ApiTags('Resto — portail étudiant')
@ApiBearerAuth()
@Controller('portail/resto')
export class PortailRestoController {
  constructor(private readonly service: RestoService) {}

  @Roles(Role.ETUDIANT)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.service.monPortefeuille(user);
  }

  /**
   * L'étudiant demande un rechargement : un Paiement et une Recharge naissent
   * EN_ATTENTE (jamais crédités directement), la réponse porte les
   * instructions de paiement par Mobile Money. La confirmation se fait au
   * guichet / en caisse.
   */
  @Roles(Role.ETUDIANT)
  @Post('recharger')
  recharger(@Body() dto: RechargerPortailDto, @CurrentUser() user: AuthUser) {
    return this.service.rechargerDepuisPortail(dto, user);
  }
}