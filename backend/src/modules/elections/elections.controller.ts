import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { baseApplicative } from '../../common/utils';
import { ElectionsService } from './elections.service';
import {
  CreateCandidatDto,
  CreateElectionDto,
  ElectionQueryDto,
  UpdateElectionDto,
  VoterDto,
} from './elections.dto';

/**
 * Plateforme d'élection des délégués et représentants.
 *
 * - Création / édition / ouverture / clôture / proclamation : ADMIN,
 *   SCOLARITE (les transitions sont explicites et verrouillées).
 * - Candidat : ADMIN, SCOLARITE (avant l'ouverture du scrutin).
 * - Vote : tout utilisateur connecté (l'électeur ne peut voter qu'une fois
 *   par scrutin — contrainte @@unique sur Prisma).
 * - Résultats : tout utilisateur connecté (utile aussi aux étudiants qui
 *   consultent le verdict après clôture).
 * - Bulletin imprimable : @Public() à jeton vérifié à la main.
 *
 * Routes « actives », « :id/resultats », « :id/candidats », « :id/imprimer-bulletin »,
 * « vote » déclarées avant `:id` pour ne pas être capturées comme identifiants.
 */
@ApiTags('Élections')
@ApiBearerAuth()
@Controller('elections')
export class ElectionsController {
  constructor(private readonly service: ElectionsService) {}

  @Get()
  liste(@Query() query: ElectionQueryDto) {
    return this.service.liste(query);
  }

  @Get('actives')
  actives() {
    return this.service.actives();
  }

  @Get(':id/mon-vote')
  monVote(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.monVote(id, user);
  }

  @Get(':id')
  trouver(@Param('id') id: string) {
    return this.service.trouver(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post()
  creer(@Body() dto: CreateElectionDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateElectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/ouvrir')
  ouvrir(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.ouvrir(id, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/clore')
  clore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.clore(id, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/proclamer')
  proclamer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.proclamer(id, user);
  }

  @Get(':id/resultats')
  resultats(@Param('id') id: string) {
    return this.service.resultats(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/candidats')
  ajouterCandidat(
    @Param('id') id: string,
    @Body() dto: CreateCandidatDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.ajouterCandidat(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Delete(':id/candidats/:candidId')
  supprimerCandidat(
    @Param('id') id: string,
    @Param('candidId') candidId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.supprimerCandidat(id, candidId, user);
  }

  @Post('vote')
  voter(
    @Body() dto: VoterDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.service.voter(dto, user, ip);
  }

  @Public()
  @Get(':id/imprimer-bulletin')
  async imprimerBulletin(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = baseApplicative(req);
    const html = await this.service.imprimerBulletin(id, token, base);
    res.type('html').send(html);
  }
}