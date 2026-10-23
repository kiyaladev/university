import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser, CurrentUser, DocumentScope, ProtectedDocument } from '../../common/decorators';
import { ImpressionService } from './impression.service';
import { AffichesQrQueryDto, RapportImprimableQueryDto, perimetrePresence } from './rapports.dto';

/**
 * États imprimables. Ouverts dans un nouvel onglet, ils ne peuvent pas porter
 * d'en-tête Authorization : le jeton est donc passé en paramètre d'URL et
 * contrôlé par la garde globale. Le HTML est renvoyé tel quel (aucune enveloppe JSON).
 */
@ApiTags('Impression')
@Controller('impression')
export class ImpressionController {
  constructor(private readonly impression: ImpressionService) {}

  private async envoyer(res: Response, html: Promise<string>) {
    res.type('html').send(await html);
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
    await this.envoyer(res, this.impression.registre(perimetrePresence(query, user)));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.ENSEIGNANT)
  @DocumentScope('enseignant', { [Role.ENSEIGNANT]: 'id', [Role.CHEF_DEPARTEMENT]: 'departementId' })
  @Get('fiche-enseignant/:id')
  async fiche(
    @Res() res: Response,
    @Param('id') id: string,
    @Query() query: RapportImprimableQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.envoyer(res, this.impression.ficheEnseignant(id, perimetrePresence(query, user)));
  }

  @ProtectedDocument(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get('etat-paiement')
  async paiement(@Res() res: Response, @Query() query: RapportImprimableQueryDto, @CurrentUser() _user: AuthUser) {
    await this.envoyer(res, this.impression.etatPaiement(query));
  }

  @ProtectedDocument(Role.ADMIN, Role.SCOLARITE)
  @Get('qr-salles')
  async qr(@Res() res: Response, @Query() query: AffichesQrQueryDto, @CurrentUser() user: AuthUser) {
    await this.envoyer(res, this.impression.affichesQr(user, query.salleId));
  }
}
