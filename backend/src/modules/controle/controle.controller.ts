import { Body, Controller, Delete, Get, Ip, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { QueryDto } from '../../common/dto';
import { ControleService } from './controle.service';
import { ControleQueryDto, PointageDto, SyncPointagesDto, UpdatePointageDto } from './controle.dto';

const CONTROLEURS = [Role.CONTROLEUR, Role.ADMIN, Role.DIRECTION, Role.CHEF_DEPARTEMENT] as const;

@ApiTags('Contrôle de présence')
@ApiBearerAuth()
@Controller('controles')
export class ControleController {
  constructor(private readonly service: ControleService) {}

  @Get() liste(@Query() query: ControleQueryDto) {
    return this.service.liste(query);
  }

  /** Scan du QR affiché dans la salle : renvoie la salle et ses séances du jour. */
  @Get('salle/:token') parQr(@Param('token') token: string, @Query('date') date?: string) {
    return this.service.parQrSalle(token, date);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Get('audit') audit(@Query() query: QueryDto & { entite?: string }) {
    return this.service.audit(query);
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** Pointage d'une séance en salle. */
  @Roles(...CONTROLEURS)
  @Post() pointer(@Body() dto: PointageDto, @CurrentUser() user: AuthUser, @Ip() ip: string) {
    return this.service.pointer(dto, user, ip);
  }

  /** Envoi groupé des pointages saisis hors connexion. */
  @Roles(...CONTROLEURS)
  @Post('sync') sync(
    @Body() dto: SyncPointagesDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.service.synchroniser(dto, user, ip);
  }

  @Roles(...CONTROLEURS)
  @Put(':id') modifier(
    @Param('id') id: string,
    @Body() dto: UpdatePointageDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.service.modifier(id, dto, user, ip);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Delete(':id') supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
