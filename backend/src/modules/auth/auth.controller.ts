import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { AuthUser, CurrentUser, Public } from '../../common/decorators';

@ApiTags('Authentification')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Deux bornes : 10 tentatives par quart d'heure sur un compte donné depuis
  // une adresse donnée — de quoi se tromper plusieurs fois, pas de quoi
  // dérouler un dictionnaire — et 60 tentatives par quart d'heure pour la même
  // adresse tous comptes confondus, qui arrête le balayage de comptes sans
  // pénaliser une salle des profs derrière un seul NAT.
  @Throttle({
    connexion: { ttl: 900_000, limit: 10 },
    courant: { ttl: 900_000, limit: 60 },
  })
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.profil(user);
  }

  @Post('mot-de-passe')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }
}
