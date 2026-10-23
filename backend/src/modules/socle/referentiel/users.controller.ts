/** Routes d’administration des comptes utilisateurs. */

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Utilisateurs')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('utilisateurs')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get() lister(@Query() query: UserQueryDto) {
    return this.service.lister(query);
  }

  @Get(':id') lire(@Param('id') id: string) {
    return this.service.lire(id);
  }

  @Post() creer(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Put(':id') modifier(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Delete(':id') supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
