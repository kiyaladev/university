import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { UpdateParametresDto } from './parametres.dto';
import { ParametresService } from './parametres.service';

@ApiTags('Paramètres')
@ApiBearerAuth()
@Controller('parametres')
export class ParametresController {
  constructor(private readonly service: ParametresService) {}

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
  @Get('pointage')
  reglesPointage() {
    return this.service.reglesPointage();
  }

  @Roles(Role.ADMIN)
  @Get()
  liste() {
    return this.service.liste();
  }

  @Roles(Role.ADMIN)
  @Put()
  enregistrer(@Body() dto: UpdateParametresDto, @CurrentUser() user: AuthUser) {
    return this.service.enregistrer(dto, user);
  }
}
