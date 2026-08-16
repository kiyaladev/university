import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
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
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Un porteur de jeton (staff) voit le fonds complet ; un visiteur sans jeton
   * ne voit que les documents publiés. Le jeton est vérifié à la main, comme
   * dans rapports/attestations : la route reste @Public(). Un jeton absent,
   * invalide ou expiré vaut visiteur anonyme — jamais d'écran d'erreur sur la
   * page publique à cause d'une session de travail périmée.
   */
  private async porteur(authorization?: string): Promise<AuthUser | null> {
    if (!authorization?.startsWith('Bearer ')) return null;
    let payload: { sub: string; iat?: number };
    try {
      payload = this.jwt.verify(authorization.slice(7));
    } catch {
      return null;
    }
    const utilisateur = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        enseignant: { select: { id: true } },
        etudiant: { select: { id: true } },
      },
    });
    if (!utilisateur || !utilisateur.actif) return null;
    return {
      id: utilisateur.id,
      email: utilisateur.email,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      role: utilisateur.role,
      departementId: utilisateur.departementId,
      enseignantId: utilisateur.enseignant?.id ?? null,
      etudiantId: utilisateur.etudiant?.id ?? null,
    };
  }

  @Public()
  @Get()
  async liste(
    @Query() query: DocumentQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.service.liste(query, await this.porteur(authorization));
  }

  /** Déclarée avant `:id` : « populaires » ne doit pas être lu comme un identifiant. */
  @Public()
  @Get('populaires')
  populaires() {
    return this.service.populaires();
  }

  /** Recherche plein texte (PostgreSQL FTS, dictionnaire `french`). */
  @Public()
  @Get('recherche')
  async rechercheFts(
    @Query() query: RechercheDocumentDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.recherche.rechercher(query, await this.porteur(authorization));
  }

  /** Tableau de bord plagiat : admin uniquement. */
  @Roles(Role.ADMIN)
  @Get('plagiat')
  dashboardPlagiat() {
    return this.plagiat.dashboard();
  }

  /** Déclenchement manuel du recalcul global : admin, coûteux (O(n²)). */
  @Roles(Role.ADMIN)
  @Post('recalculer-plagiat')
  async recalculerPlagiat(@CurrentUser() utilisateur: AuthUser) {
    const resultat = await this.plagiat.recalculerComplet();
    await this.prisma.auditLog.create({
      data: {
        userId: utilisateur.id,
        action: 'PLAGIAT_RECALCUL',
        entite: 'SuspicionPlagiat',
        details: `${resultat.creees} créées, ${resultat.misesAJour} mises à jour, ${resultat.ignorees} ignorées.`,
      },
    });
    return resultat;
  }

  @Roles(Role.ADMIN)
  @Get('plagiat/:id')
  detailPlagiat(@Param('id') id: string) {
    return this.plagiat.detail(id);
  }

  /** Acquittement humain d'une suspicion : admin et direction. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post('plagiat/:id/acquitter')
  acquitter(
    @Param('id') id: string,
    @Body() dto: AcquitterPlagiatDto,
    @CurrentUser() utilisateur: AuthUser,
  ) {
    return this.plagiat.acquitter(id, dto.decision, utilisateur, dto.commentaire);
  }

  @Get(':id')
  details(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /**
   * Téléchargement public : data-url décodé, content-type par typeMime.
   * Seul cet appel compte un téléchargement dans la statistique.
   */
  @Public()
  @Get(':id/fichier')
  async fichier(
    @Param('id') id: string,
    @Res() res: Response,
    @Headers('authorization') authorization?: string,
  ) {
    const { octets, mime, nom } = await this.service.fichier(id, await this.porteur(authorization));
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
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() utilisateur: AuthUser,
  ) {
    return this.service.modifier(id, dto, utilisateur);
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() utilisateur: AuthUser) {
    return this.service.supprimer(id, utilisateur);
  }
}
