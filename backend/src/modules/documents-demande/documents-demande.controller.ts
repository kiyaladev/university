import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { DocumentsDemandeService } from './documents-demande.service';
import {
  CreerDemandeDto,
  CreerTarifDto,
  DocumentsDemandeQueryDto,
  LancerTraitementDto,
  MarquerPreteDto,
  MesDemandesQueryDto,
  ModePaiementDto,
  ModifierTarifDto,
  PayerDto,
  RemettreDto,
  RejeterDemandeDto,
} from './documents-demande.dto';

/** Rôles autorisés sur le registre — la direction est lisible. */
const ROLES_GESTION = [Role.ADMIN, Role.SCOLARITE] as const;

@ApiTags('Demandes de documents')
@ApiBearerAuth()
@Controller('documents-demande')
export class DocumentsDemandeController {
  constructor(
    private readonly service: DocumentsDemandeService,
    private readonly jwt: JwtService,
  ) {}

  // ---------- lecture : vues étudiant

  @Roles(Role.ETUDIANT)
  @Get('mes')
  mes(@Query() query: MesDemandesQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.mesDemandes(query, user);
  }

  // ---------- lecture : registre

  @Roles(...ROLES_GESTION)
  @Get()
  liste(@Query() query: DocumentsDemandeQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  @Roles(...ROLES_GESTION)
  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  // ---------- tarifs

  @Get('tarifs')
  tarifs() {
    return this.service.listeTarifs();
  }

  @Roles(Role.ADMIN)
  @Post('tarifs')
  creerTarif(@Body() dto: CreerTarifDto) {
    return this.service.creerTarif(dto);
  }

  @Roles(Role.ADMIN)
  @Put('tarifs/:id')
  modifierTarif(@Param('id') id: string, @Body() dto: ModifierTarifDto) {
    return this.service.modifierTarif(id, dto);
  }

  // ---------- détail

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOnePour(id, user);
  }

  // ---------- cycle étudiant

  @Roles(Role.ETUDIANT)
  @Post()
  creer(@Body() dto: CreerDemandeDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ETUDIANT)
  @Post(':id/payer')
  payer(
    @Param('id') id: string,
    @Body() dto: PayerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.payer(id, dto, user);
  }

  // ---------- cycle scolarité / admin

  @Roles(...ROLES_GESTION)
  @Post(':id/confirmer-paiement')
  confirmerPaiement(
    @Param('id') id: string,
    @Body() dto: ModePaiementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.confirmerPaiement(id, dto, user);
  }

  @Roles(...ROLES_GESTION)
  @Post(':id/lancer-traitement')
  lancerTraitement(
    @Param('id') id: string,
    @Body() _dto: LancerTraitementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.lancerTraitement(id, user);
  }

  @Roles(...ROLES_GESTION)
  @Post(':id/prete')
  marquerPrete(
    @Param('id') id: string,
    @Body() dto: MarquerPreteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.marquerPrete(id, dto, user);
  }

  @Roles(...ROLES_GESTION)
  @Post(':id/remettre')
  remettre(
    @Param('id') id: string,
    @Body() dto: RemettreDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.remettre(id, dto, user);
  }

  @Roles(...ROLES_GESTION)
  @Post(':id/rejeter')
  rejeter(
    @Param('id') id: string,
    @Body() dto: RejeterDemandeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.rejeter(id, dto, user);
  }

  // ---------- impression : route publique à jeton vérifié manuellement

  @Public()
  @Get(':id/imprimer')
  async imprimer(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.jwt.verify(token ?? '');
    } catch {
      res.status(401).send('Jeton invalide ou expiré');
      return;
    }
    const demande = await this.service.findOne(id);
    res.type('html').send(this.documentHtml(demande, req));
  }

  private documentHtml(demande: any, _req: Request): string {
    const numero = demande.numero ?? '';
    const type = demande.type ?? '';
    const etudiant = demande.etudiant
      ? `${demande.etudiant.prenom ?? ''} ${demande.etudiant.nom ?? ''}`.trim()
      : '—';
    const matricule = demande.etudiant?.matricule ?? '—';
    const inscription = demande.inscription?.numero ?? '—';
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Demande ${numero}</title>
<style>body{font-family:Helvetica,Arial,sans-serif;margin:24px;color:#10251E}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #c9ccc4;padding:6px 10px;text-align:left}th{background:#f2f3ee}</style></head>
<body><h1>Demande ${numero}</h1>
<table><tbody><tr><th>Type</th><td>${type}</td></tr>
<tr><th>Étudiant</th><td>${etudiant} (${matricule})</td></tr>
<tr><th>Inscription</th><td>${inscription}</td></tr>
<tr><th>Statut</th><td>${demande.statut}</td></tr>
<tr><th>Frais</th><td>${demande.frais} ${demande.devise}</td></tr>
<tr><th>Créée le</th><td>${demande.creeLe ?? ''}</td></tr>
</tbody></table></body></html>`;
  }
}