import { Role } from '@prisma/client';
import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles, ProtectedDocument, DocumentScope } from '../../common/decorators';
import { verifierJetonImprimable } from '../../common/jeton-imprimable';
import { ParametresModule } from '../parametres/parametres.module';
import { RapportsService } from './rapports.service';
import { ImpressionService } from './impression.service';
import { ExportService } from './export.service';
import { RapportQueryDto, perimetrePresence } from './rapports.dto';
import { CouvertureControleursController } from './couverture-controleurs.controller';
import { ReleveHebdomadaireController } from './releve-pdf.controller';
import { RelevePdfService } from './releve-pdf.service';

@ApiTags('Rapports')
@ApiBearerAuth()
@Controller('rapports')
@Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
export class RapportsController {
  constructor(private readonly service: RapportsService) {}

  @Get('dashboard') dashboard(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.dashboard(perimetrePresence(query, user));
  }

  @Get('presence-enseignants') presence(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.presenceEnseignants(perimetrePresence(query, user));
  }

  /** Statistiques par salle : le terrain du contrôleur. */
  @Get('salles') salles(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.parSalle(perimetrePresence(query, user));
  }

  @Get('volume-horaire') volume(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.volumeHoraire(perimetrePresence(query, user));
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get('etat-paiement') paiement(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.etatPaiement(query);
  }

  @Get('registre') registre(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    const inclureObservations = user.role === Role.ADMIN
      || user.role === Role.DIRECTION
      || user.role === Role.SCOLARITE;
    return this.service.registre(perimetrePresence(query, user), false, inclureObservations);
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.ENSEIGNANT)
  @DocumentScope('enseignant', { [Role.ENSEIGNANT]: 'id', [Role.CHEF_DEPARTEMENT]: 'departementId' })
  @Get('fiche-enseignant/:id') fiche(@Param('id') id: string, @Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    const inclureObservations = user.role === Role.ADMIN
      || user.role === Role.DIRECTION
      || user.role === Role.SCOLARITE;
    return this.service.ficheEnseignant(id, perimetrePresence(query, user), inclureObservations);
  }

  /** Fiche de l'enseignant connecté. */
  @Roles(Role.ENSEIGNANT)
  @Get('ma-fiche') maFiche(@CurrentUser() user: AuthUser, @Query() query: RapportQueryDto) {
    return this.service.ficheEnseignant(user.enseignantId ?? '—', query);
  }
}

/**
 * États imprimables. Ouverts dans un nouvel onglet, ils ne peuvent pas porter
 * d'en-tête Authorization : le jeton est donc passé en paramètre d'URL et
 * vérifié ici. Le HTML est renvoyé tel quel (aucune enveloppe JSON).
 */
@ApiTags('Impression')
@Controller('impression')
export class ImpressionController {
  constructor(
    private readonly impression: ImpressionService,
    private readonly jwt: JwtService,
  ) {}

  private async envoyer(res: Response, html: Promise<string>) {
    res.type('html').send(await html);
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
  @Get('registre')
  async registre(@Res() res: Response, @Req() req: Request, @Query() query: RapportQueryDto & { token?: string }, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, this.impression.registre(perimetrePresence(query, user)));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.ENSEIGNANT)
  @DocumentScope('enseignant', { [Role.ENSEIGNANT]: 'id', [Role.CHEF_DEPARTEMENT]: 'departementId' })
  @Get('fiche-enseignant/:id')
  async fiche(
    @Res() res: Response,
    @Param('id') id: string,
    @Req() req: Request, @Query() query: RapportQueryDto & { token?: string },
    @CurrentUser() user: AuthUser,
  ) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, this.impression.ficheEnseignant(id, perimetrePresence(query, user)));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get('etat-paiement')
  async paiement(@Res() res: Response, @Req() req: Request, @Query() query: RapportQueryDto & { token?: string }, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, this.impression.etatPaiement(query));
  }

  @ProtectedDocument(Role.ADMIN, Role.SCOLARITE)
  @Get('qr-salles')
  async qr(
    @Res() res: Response,
    @Req() req: Request,
    @Query() query: { token?: string; salleId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, this.impression.affichesQr(user, query.salleId));
  }

}

/** Exports CSV (tableur) — même principe d'authentification par jeton en URL. */
@ApiTags('Export')
@Controller('export')
export class ExportController {
  constructor(
    private readonly exports: ExportService,
    private readonly jwt: JwtService,
  ) {}

  private async envoyer(res: Response, nom: string, csv: Promise<string>) {
    res
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${nom}.csv"`)
      .send(await csv);
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
  @Get('presence-enseignants')
  async presence(@Res() res: Response, @Req() req: Request, @Query() query: RapportQueryDto & { token?: string }, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(
      res,
      `assiduite-${query.dateDebut ?? ''}_${query.dateFin ?? ''}`,
      this.exports.presenceEnseignants(perimetrePresence(query, user)),
    );
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
  @Get('volume-horaire')
  async volume(@Res() res: Response, @Req() req: Request, @Query() query: RapportQueryDto & { token?: string }, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, 'volume-horaire', this.exports.volumeHoraire(perimetrePresence(query, user)));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get('etat-paiement')
  async paiement(@Res() res: Response, @Req() req: Request, @Query() query: RapportQueryDto & { token?: string }, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, 'etat-paiement', this.exports.etatPaiement(query));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
  @Get('registre')
  async registre(@Res() res: Response, @Req() req: Request, @Query() query: RapportQueryDto & { token?: string }, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    const inclureObservations = user.role === Role.ADMIN
      || user.role === Role.DIRECTION
      || user.role === Role.SCOLARITE;
    await this.envoyer(res, `registre-${query.dateDebut ?? query.date ?? ''}`, this.exports.registre(perimetrePresence(query, user), inclureObservations));
  }
}

@Module({
  imports: [
    ParametresModule,
  ],
  controllers: [RapportsController, ImpressionController, ExportController, ReleveHebdomadaireController, CouvertureControleursController],
  providers: [RapportsService, ImpressionService, ExportService, RelevePdfService],
  exports: [RapportsService],
})
export class RapportsModule {}
