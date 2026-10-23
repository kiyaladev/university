import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators';
import { RapportQueryDto } from './rapports.dto';
import { RapportsService } from './rapports.service';

@ApiTags('Rapports')
@ApiBearerAuth()
@Controller('rapports')
@Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
export class CouvertureControleursController {
  constructor(private readonly rapports: RapportsService) {}

  @Get('couverture-controleurs')
  couverture(@Query() query: RapportQueryDto) {
    return this.rapports.couvertureControleurs(query);
  }
}
