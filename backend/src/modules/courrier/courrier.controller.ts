import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import {
  CloturerCourrierDto,
  CourrierQueryDto,
  CreateCourrierDto,
  ParapherCourrierDto,
  UpdateCourrierDto,
} from './courrier.dto';
import { CourrierService } from './courrier.service';

@ApiTags('Courrier')
@ApiBearerAuth()
@Controller('courrier')
export class CourrierController {
  constructor(
    private readonly service: CourrierService,
    private readonly jwt: JwtService,
  ) {}

  @Get()
  liste(@Query() query: CourrierQueryDto) {
    return this.service.liste(query);
  }

  /** Déclaré avant `:id` pour ne pas être capturé par le handler générique. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.trouver(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post()
  creer(@Body() dto: CreateCourrierDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateCourrierDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifier(id, dto, user);
  }

  /**
   * Valideur courant : paraphe à l'étape `circuitId`. Le service trace quel
   * utilisateur a fait quoi ; le statut du courrier passe à TRAITE lorsque
   * toutes les étapes le sont.
   */
  @Post(':id/parapher/:circuitId')
  parapher(
    @Param('id') id: string,
    @Param('circuitId') circuitId: string,
    @Body() dto: ParapherCourrierDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.parapher(id, circuitId, dto, user);
  }

  /** ADMIN : EN_CIRCUIT → TRAITE → CLASSE → ARCHIVE. */
  @Roles(Role.ADMIN)
  @Post(':id/cloturer')
  cloturer(
    @Param('id') id: string,
    @Body() dto: CloturerCourrierDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cloturer(id, dto, user);
  }

  /**
   * Feuille A4 — ouverte dans un nouvel onglet ; l'en-tête Authorization
   * n'y arrive pas, le jeton passe donc en query string et est vérifié ici.
   */
  @Public()
  @Get(':id/imprimer')
  async imprimer(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    try {
      this.jwt.verify(token ?? '', {
        secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      });
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
    res.type('html').send(await this.service.imprimer(id));
  }
}
