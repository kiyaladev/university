import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { ImportCsvDto } from './imports.dto';
import { ImportsService } from './imports.service';

@ApiTags('Imports de référentiels')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SCOLARITE)
@Controller('imports/referentiels')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Post('previsualiser') previsualiser(@Body() dto: ImportCsvDto) {
    return this.service.previsualiser(dto);
  }

  @Post('appliquer') appliquer(@Body() dto: ImportCsvDto, @CurrentUser() user: AuthUser) {
    return this.service.importer(dto, user);
  }
}
