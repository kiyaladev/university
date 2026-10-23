import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../../common/decorators';
import { AuthentificationOptionnelle, UtilisateurOptionnel } from '../../../common/utilisateur-optionnel';
import {
  AcquitterPlagiatDto,
  CreateDocumentDto,
  DocumentQueryDto,
  RechercheDocumentDto,
  UpdateDocumentDto,
} from './bibliotheque.dto';
import { BibliothequeService } from './bibliotheque.service';
import { PlagiatService } from './plagiat.service';
import { RechercheService } from './recherche.service';

/**
 * Dépôt institutionnel & bibliothèque numérique. La lecture est ouverte à
 * tous : la page publique consulte la même liste et la même route de fichier
 * que le staff. L'écriture est réservée à l'administration, la direction et
 * la scolarité — et, sauf ADMIN, au déposant initial.
 *
 * Routes spécialisées : recherche plein texte (FTS), détection de doublons
 * (POST/PUT) et tableau de bord plagiat (admin/direction).
 */
@ApiTags('Bibliothèque')
@ApiBearerAuth()
@Controller('documents')
export class BibliothequeController {
  constructor(
    private readonly service: BibliothequeService,
    private readonly recherche: RechercheService,
    private readonly plagiat: PlagiatService,
  ) {}

  @Public()
  @AuthentificationOptionnelle()
  @Get()
  async liste(@Query() query: DocumentQueryDto, @UtilisateurOptionnel() utilisateur?: AuthUser) {
    return this.service.liste(query, utilisateur ?? null);
  }

  /** Déclarée avant `:id` : « populaires » ne doit pas être lu comme un identifiant. */
  @Public()
  @Get('populaires')
  populaires() {
    return this.service.populaires();
  }

  /** Recherche plein texte (PostgreSQL FTS, dictionnaire `french`). */
  @Public()
  @AuthentificationOptionnelle()
  @Throttle({ courant: { ttl: 60_000, limit: 30 } })
  @Get('recherche')
  async rechercheFts(@Query() query: RechercheDocumentDto, @UtilisateurOptionnel() utilisateur?: AuthUser) {
    return this.recherche.rechercher(query, utilisateur ?? null);
  }

  /** Tableau de bord plagiat : la direction arbitre, elle doit donc le lire. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Get('plagiat')
  dashboardPlagiat() {
    return this.plagiat.dashboard();
  }

  /** Déclenchement manuel du recalcul global : admin, coûteux (O(n²)). */
  @Roles(Role.ADMIN)
  @Post('recalculer-plagiat')
  async recalculerPlagiat(@CurrentUser() utilisateur: AuthUser) {
    return this.plagiat.recalculerComplet(utilisateur);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Get('plagiat/:id')
  detailPlagiat(@Param('id') id: string) {
    return this.plagiat.detail(id);
  }

  /** Acquittement humain d'une suspicion : admin et direction. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post('plagiat/:id/acquitter')
  acquitter(@Param('id') id: string, @Body() dto: AcquitterPlagiatDto, @CurrentUser() utilisateur: AuthUser) {
    return this.plagiat.acquitter(id, dto.decision, utilisateur, dto.commentaire);
  }

  @Get(':id')
  details(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.detailPour(id, user);
  }

  /**
   * Téléchargement public : data-url décodé, content-type par typeMime.
   * Seul cet appel compte un téléchargement dans la statistique.
   */
  @Public()
  @AuthentificationOptionnelle()
  @Get(':id/fichier')
  async fichier(@Param('id') id: string, @Res() res: Response, @UtilisateurOptionnel() utilisateur?: AuthUser) {
    const { octets, mime, nom } = await this.service.fichier(id, utilisateur ?? null);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${nom}"`);
    res.send(octets);
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Post()
  deposer(@Body() dto: CreateDocumentDto, @CurrentUser() utilisateur: AuthUser) {
    return this.service.deposer(dto, utilisateur);
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() utilisateur: AuthUser) {
    return this.service.modifier(id, dto, utilisateur);
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() utilisateur: AuthUser) {
    return this.service.supprimer(id, utilisateur);
  }
}
