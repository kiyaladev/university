import { Controller, Get, Param, Query, Res, UnauthorizedException } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public } from '../../common/decorators';
import { ParametresModule } from '../parametres/parametres.module';
import { RapportsService } from './rapports.service';
import { ImpressionService } from './impression.service';
import { ExportService } from './export.service';
import { RapportQueryDto } from './rapports.dto';

@ApiTags('Rapports')
@ApiBearerAuth()
@Controller('rapports')
export class RapportsController {
  constructor(private readonly service: RapportsService) {}

  @Get('dashboard') dashboard(@Query() query: RapportQueryDto) {
    return this.service.dashboard(query);
  }

  @Get('presence-enseignants') presence(@Query() query: RapportQueryDto) {
    return this.service.presenceEnseignants(query);
  }

  /** Statistiques par salle : le terrain du contrôleur. */
  @Get('salles') salles(@Query() query: RapportQueryDto) {
    return this.service.parSalle(query);
  }

  @Get('volume-horaire') volume(@Query() query: RapportQueryDto) {
    return this.service.volumeHoraire(query);
  }

  @Get('etat-paiement') paiement(@Query() query: RapportQueryDto) {
    return this.service.etatPaiement(query);
  }

  @Get('registre') registre(@Query() query: RapportQueryDto) {
    return this.service.registre(query);
  }

  @Get('fiche-enseignant/:id') fiche(@Param('id') id: string, @Query() query: RapportQueryDto) {
    return this.service.ficheEnseignant(id, query);
  }

  /** Fiche de l'enseignant connecté. */
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

  private verifier(token?: string) {
    try {
      this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
  }

  private async envoyer(res: Response, html: Promise<string>) {
    res.type('html').send(await html);
  }

  @Public()
  @Get('registre')
  async registre(@Res() res: Response, @Query() query: RapportQueryDto & { token?: string }) {
    this.verifier(query.token);
    await this.envoyer(res, this.impression.registre(query));
  }

  @Public()
  @Get('fiche-enseignant/:id')
  async fiche(
    @Res() res: Response,
    @Param('id') id: string,
    @Query() query: RapportQueryDto & { token?: string },
  ) {
    this.verifier(query.token);
    await this.envoyer(res, this.impression.ficheEnseignant(id, query));
  }

  @Public()
  @Get('etat-paiement')
  async paiement(@Res() res: Response, @Query() query: RapportQueryDto & { token?: string }) {
    this.verifier(query.token);
    await this.envoyer(res, this.impression.etatPaiement(query));
  }

  @Public()
  @Get('qr-salles')
  async qr(@Res() res: Response, @Query() query: { token?: string; salleId?: string }) {
    this.verifier(query.token);
    await this.envoyer(res, this.impression.affichesQr(query.salleId));
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

  private verifier(token?: string) {
    try {
      this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
  }

  private async envoyer(res: Response, nom: string, csv: Promise<string>) {
    res
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${nom}.csv"`)
      .send(await csv);
  }

  @Public()
  @Get('presence-enseignants')
  async presence(@Res() res: Response, @Query() query: RapportQueryDto & { token?: string }) {
    this.verifier(query.token);
    await this.envoyer(
      res,
      `assiduite-${query.dateDebut ?? ''}_${query.dateFin ?? ''}`,
      this.exports.presenceEnseignants(query),
    );
  }

  @Public()
  @Get('volume-horaire')
  async volume(@Res() res: Response, @Query() query: RapportQueryDto & { token?: string }) {
    this.verifier(query.token);
    await this.envoyer(res, 'volume-horaire', this.exports.volumeHoraire(query));
  }

  @Public()
  @Get('etat-paiement')
  async paiement(@Res() res: Response, @Query() query: RapportQueryDto & { token?: string }) {
    this.verifier(query.token);
    await this.envoyer(res, 'etat-paiement', this.exports.etatPaiement(query));
  }

  @Public()
  @Get('registre')
  async registre(@Res() res: Response, @Query() query: RapportQueryDto & { token?: string }) {
    this.verifier(query.token);
    await this.envoyer(res, `registre-${query.dateDebut ?? query.date ?? ''}`, this.exports.registre(query));
  }
}

@Module({
  imports: [
    ParametresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [RapportsController, ImpressionController, ExportController],
  providers: [RapportsService, ImpressionService, ExportService],
  exports: [RapportsService],
})
export class RapportsModule {}
