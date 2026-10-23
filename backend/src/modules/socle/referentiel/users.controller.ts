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

  @Get() findAll(@Query() query: UserQueryDto) {
    return this.service.list(query);
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post() create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
