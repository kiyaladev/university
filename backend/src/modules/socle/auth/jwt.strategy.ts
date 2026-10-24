import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { t } from '../../../common/i18n';
import { motDePasseDemo } from '../../../common/demo-accounts';
import { optionsJwt } from '../../../common/jwt-config.module';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Même résolution que la signature (JwtConfigModule) : secret de la
      // configuration, repli d'exemple hors production, refus en production.
      // Un seul endroit décide, il ne peut pas y avoir deux secrets.
      secretOrKey: optionsJwt(config).secret,
    });
  }

  async validate(payload: { sub: string; iat?: number }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        enseignant: { select: { id: true } },
        etudiant: { select: { id: true } },
      },
    });

    if (!user || !user.actif) {
      throw new UnauthorizedException(t('auth.compte_inexistant_ou_desactive'));
    }
    if (process.env.NODE_ENV === 'production' && (await motDePasseDemo(user.password))) {
      throw new UnauthorizedException(t('auth.compte_inexistant_ou_desactive'));
    }

    // Révocation sans liste noire : un jeton émis avant le dernier changement
    // de mot de passe n'est plus recevable. La tolérance d'une seconde absorbe
    // l'arrondi de `iat`, qui est en secondes alors que la date est en ms.
    if (payload.iat && user.motDePasseModifieLe) {
      if (payload.iat * 1000 < user.motDePasseModifieLe.getTime() - 1000) {
        throw new UnauthorizedException(t('auth.session_expiree_reconnectez_vous'));
      }
    }

    return {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
      departementId: user.departementId,
      enseignantId: user.enseignant?.id ?? null,
      etudiantId: user.etudiant?.id ?? null,
    };
  }
}
