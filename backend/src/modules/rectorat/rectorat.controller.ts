/**
 * Tableau de bord du Rectorat — routes.
 *
 * Routes publiques : impression du bilan MESRS (le QR ministry scanne le
 * PDF, le jeton vérifie à la main comme les attestations).
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { baseApplicative } from '../../common/utils';
import { RectoratService } from './rectorat.service';
import { GenererBilanDto, RectoratQueryDto } from './rectorat.dto';

/** Direction + administration : le Rectorat est un public resserré. */
const ROLES_RECTORAT = [Role.ADMIN, Role.DIRECTION];

@ApiTags('Rectorat')
@ApiBearerAuth()
@Controller('rectorat')
export class RectoratController {
  constructor(private readonly service: RectoratService) {}

  @Roles(...ROLES_RECTORAT)
  @Get('dashboard')
  dashboard() {
    return this.service.dashboardRapide();
  }

  @Roles(...ROLES_RECTORAT)
  @Get('chiffres')
  chiffres(@Query() query: RectoratQueryDto) {
    return this.service.chiffres(query.anneeId);
  }

  @Roles(...ROLES_RECTORAT)
  @Get('bilan-mesrs')
  bilans(@Query() query: RectoratQueryDto) {
    return this.service.bilans(query.anneeId);
  }

  @Roles(Role.ADMIN)
  @Post('bilan-mesrs/generer')
  generer(@Body() dto: GenererBilanDto, @CurrentUser() user: AuthUser) {
    return this.service.genererBilan(dto.anneeId, user);
  }

  /**
   * Bilan MESRS en A4, ouvert dans un nouvel onglet. Public + jeton en query
   * string : la fenêtre d'impression n'envoie pas l'en-tête Authorization.
   */
  @Public()
  @Get('bilan-mesrs/:id/imprimer')
  async imprimer(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = baseApplicative(req);
    res.type('html').send(await this.service.imprimerBilan(id, token, base));
  }
}
