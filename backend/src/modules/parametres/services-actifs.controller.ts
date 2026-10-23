import { Body, Controller, Get, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { ServicesActifsDto, ServicesActifsService } from './services-actifs.service';

@Controller('services-actifs')
export class ServicesActifsController {
  constructor(private readonly service: ServicesActifsService) {}
  @Public() @Get() liste() { return this.service.liste(); }
  @Roles(Role.ADMIN) @Put() enregistrer(@Body() dto: ServicesActifsDto, @CurrentUser() user: AuthUser) { return this.service.enregistrer(dto, user); }
}
