import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { t } from '../../common/i18n';
import { motDePasseDemo } from '../../common/demo-accounts';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Lu via ConfigService, et non `process.env` : la stratégie est
      // construite par injection, donc le `.env` est déjà chargé, mais la
      // clé reste ainsi définie à un seul endroit (JwtConfigModule).
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'change-me-in-production',
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
    if (process.env.NODE_ENV === 'production' && await motDePasseDemo(user.password)) {
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
