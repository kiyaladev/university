import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser, CurrentUser, ProtectedDocument } from '../../common/decorators';
import { ExportService } from './export.service';
import { RapportImprimableQueryDto, perimetrePresence } from './rapports.dto';

/** Exports CSV (tableur) — même principe d'authentification par jeton en URL. */
@ApiTags('Export')
@Controller('export')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  private async envoyer(res: Response, nom: string, csv: Promise<string>) {
    res
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${nom}.csv"`)
      .send(await csv);
  }

  @ProtectedDocument(
    Role.ADMIN,
    Role.DIRECTION,
    Role.SCOLARITE,
    Role.CHEF_DEPARTEMENT,
    Role.CONTROLEUR,
    Role.ENSEIGNANT,
  )
  @Get('presence-enseignants')
  async presence(@Res() res: Response, @Query() query: RapportImprimableQueryDto, @CurrentUser() user: AuthUser) {
    await this.envoyer(
      res,
      `assiduite-${query.dateDebut ?? ''}_${query.dateFin ?? ''}`,
      this.exports.presenceEnseignants(perimetrePresence(query, user)),
    );
  }

  @ProtectedDocument(
    Role.ADMIN,
    Role.DIRECTION,
    Role.SCOLARITE,
    Role.CHEF_DEPARTEMENT,
    Role.CONTROLEUR,
    Role.ENSEIGNANT,
  )
  @Get('volume-horaire')
  async volume(@Res() res: Response, @Query() query: RapportImprimableQueryDto, @CurrentUser() user: AuthUser) {
    await this.envoyer(res, 'volume-horaire', this.exports.volumeHoraire(perimetrePresence(query, user)));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get('etat-paiement')
  async paiement(@Res() res: Response, @Query() query: RapportImprimableQueryDto, @CurrentUser() _user: AuthUser) {
    await this.envoyer(res, 'etat-paiement', this.exports.etatPaiement(query));
  }

  @ProtectedDocument(
    Role.ADMIN,
    Role.DIRECTION,
    Role.SCOLARITE,
    Role.CHEF_DEPARTEMENT,
    Role.CONTROLEUR,
    Role.ENSEIGNANT,
  )
  @Get('registre')
  async registre(@Res() res: Response, @Query() query: RapportImprimableQueryDto, @CurrentUser() user: AuthUser) {
    const inclureObservations =
      user.role === Role.ADMIN || user.role === Role.DIRECTION || user.role === Role.SCOLARITE;
    await this.envoyer(
      res,
      `registre-${query.dateDebut ?? query.date ?? ''}`,
      this.exports.registre(perimetrePresence(query, user), inclureObservations),
    );
  }
}
