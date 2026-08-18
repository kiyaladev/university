/** Salles de cours : chaque salle porte un jeton QR affiché à l'entrée et,
 *  optionnellement, ses coordonnées GPS pour vérifier la présence sur site. */
import { Body, Controller, Delete, Get, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CrudService, supprimerOuConflit } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { Roles } from '../../common/decorators';

export class CreateSalleDto {
  @IsString() code: string;
  @IsString() nom: string;
  @IsOptional() @IsString() batiment?: string;
  @IsOptional() @IsInt() @Min(0) capacite?: number;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsInt() @Min(10) rayonMetres?: number;
  @IsOptional() @IsBoolean() actif?: boolean;
}
export class UpdateSalleDto extends PartialType(CreateSalleDto) {}

@Injectable()
export class SallesService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'salle', {
      searchFields: ['code', 'nom', 'batiment'],
      orderBy: { code: 'asc' },
      label: 'Salle',
    });
  }

  private nouveauToken() {
    return `UP-${randomBytes(9).toString('base64url')}`;
  }

  async creer(dto: CreateSalleDto) {
    return this.create({ ...dto, qrToken: this.nouveauToken() });
  }

  /** Régénère le QR (affiche invalidée, ex. affiche photographiée/diffusée). */
  async regenererQr(id: string) {
    await this.findOne(id);
    return this.prisma.salle.update({
      where: { id },
      data: { qrToken: this.nouveauToken() },
    });
  }

  /** Une salle où des séances ou des réservations sont posées se garde. */
  async remove(id: string) {
    return supprimerOuConflit(
      () => super.remove(id),
      'Cette salle ne peut pas être supprimée : des séances ou des réservations y sont rattachées. Désactivez-la plutôt que de la supprimer.',
    );
  }
}

@ApiTags('Salles')
@ApiBearerAuth()
@Controller('salles')
export class SallesController {
  constructor(private readonly service: SallesService) {}

  @Get() findAll(@Query() query: QueryDto) {
    return this.service.findAll(query);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post() create(@Body() dto: CreateSalleDto) {
    return this.service.creer(dto);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateSalleDto) {
    return this.service.update(id, dto);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/qr') regenerer(@Param('id') id: string) {
    return this.service.regenererQr(id);
  }
  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
