import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, DocumentScope, ProtectedDocument } from '../../common/decorators';
import { verifierJetonImprimable } from '../../common/jeton-imprimable';
import { ImpressionService } from './impression.service';
import { AffichesQrQueryDto, RapportImprimableQueryDto, perimetrePresence } from './rapports.dto';

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
  async registre(@Res() res: Response, @Req() req: Request, @Query() query: RapportImprimableQueryDto, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, this.impression.registre(perimetrePresence(query, user)));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.ENSEIGNANT)
  @DocumentScope('enseignant', { [Role.ENSEIGNANT]: 'id', [Role.CHEF_DEPARTEMENT]: 'departementId' })
  @Get('fiche-enseignant/:id')
  async fiche(
    @Res() res: Response,
    @Param('id') id: string,
    @Req() req: Request, @Query() query: RapportImprimableQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, this.impression.ficheEnseignant(id, perimetrePresence(query, user)));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get('etat-paiement')
  async paiement(@Res() res: Response, @Req() req: Request, @Query() query: RapportImprimableQueryDto, @CurrentUser() user: AuthUser) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, this.impression.etatPaiement(query));
  }

  @ProtectedDocument(Role.ADMIN, Role.SCOLARITE)
  @Get('qr-salles')
  async qr(
    @Res() res: Response,
    @Req() req: Request,
    @Query() query: AffichesQrQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    verifierJetonImprimable(this.jwt, req);
    await this.envoyer(res, this.impression.affichesQr(user, query.salleId));
  }

}
