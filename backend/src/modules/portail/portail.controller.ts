import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { PortailService } from './portail.service';
import { DemandeCodeOtpDto, VerifierOtpDto } from './portail.dto';

@ApiTags('Portail étudiant')
@ApiBearerAuth()
@Controller('portail')
export class PortailController {
  constructor(private readonly portail: PortailService) {}

  /**
   * 5 demandes par minute et par adresse : la passerelle plafonne déjà à
   * 5 envois par heure et par numéro ; ce compteur-ci arrête la rafale de
   * sondage. Réponse toujours 202 : un numéro inconnu ne se distingue pas
   * d'un numéro connu (voir portail.service — demanderCode).
   */
  @Throttle({ connexion: { ttl: 60_000, limit: 5 } })
  @Public()
  @Post('otp')
  @HttpCode(202)
  async demanderCode(@Body() dto: DemandeCodeOtpDto) {
    await this.portail.demanderCode(dto.telephone);
    return { ok: true };
  }

  /** 10 tentatives de code par minute et par adresse. */
  @Throttle({ connexion: { ttl: 60_000, limit: 10 } })
  @Public()
  @Post('otp/verifier')
  verifierCode(@Body() dto: VerifierOtpDto, @Ip() ip: string) {
    return this.portail.verifierCode(dto.telephone, dto.code, ip);
  }

  /**
   * Profil complet, borné à la fiche de l'utilisateur connecté
   * (`AuthUser.etudiantId`) : un compte sans fiche ne voit rien.
   */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.portail.profilPortail(user);
  }

  @Roles(Role.ETUDIANT)
  @Get('resultats')
  resultats(@CurrentUser() user: AuthUser) {
    return this.portail.resultats(user);
  }
}