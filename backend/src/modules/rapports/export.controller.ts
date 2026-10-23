import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, ProtectedDocument } from '../../common/decorators';
import { verifierJetonImprimable } from '../../common/jeton-imprimable';
import { ExportService } from './export.service';
import { RapportImprimableQueryDto, perimetrePresence } from './rapports.dto';

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
  async presence(@Res() res: Response, @Req() req: Request, @Query() query: RapportImprimableQueryDto, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(
      res,
      `assiduite-${query.dateDebut ?? ''}_${query.dateFin ?? ''}`,
      this.exports.presenceEnseignants(perimetrePresence(query, user)),
    );
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
  @Get('volume-horaire')
  async volume(@Res() res: Response, @Req() req: Request, @Query() query: RapportImprimableQueryDto, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, 'volume-horaire', this.exports.volumeHoraire(perimetrePresence(query, user)));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get('etat-paiement')
  async paiement(@Res() res: Response, @Req() req: Request, @Query() query: RapportImprimableQueryDto, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, 'etat-paiement', this.exports.etatPaiement(query));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
  @Get('registre')
  async registre(@Res() res: Response, @Req() req: Request, @Query() query: RapportImprimableQueryDto, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    const inclureObservations = user.role === Role.ADMIN
      || user.role === Role.DIRECTION
      || user.role === Role.SCOLARITE;
    await this.envoyer(res, `registre-${query.dateDebut ?? query.date ?? ''}`, this.exports.registre(perimetrePresence(query, user), inclureObservations));
  }
}
