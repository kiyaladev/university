import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { ChangePasswordDto, LoginDto } from './auth.dto';

/**
 * Verrouillage après échecs répétés. Le débit par IP est déjà bridé par le
 * ThrottlerGuard ; ce compteur-ci suit le *compte*, pour qu'une attaque
 * distribuée sur plusieurs adresses bute quand même sur le même mur.
 */
const ECHECS_AVANT_VERROUILLAGE = Number(process.env.AUTH_ECHECS_MAX ?? 10);
const DUREE_VERROUILLAGE_MIN = Number(process.env.AUTH_VERROU_MINUTES ?? 15);

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { enseignant: { select: { id: true } }, departement: true },
    });

    if (user?.verrouilleJusqua && user.verrouilleJusqua > new Date()) {
      const minutes = Math.ceil((user.verrouilleJusqua.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Trop de tentatives : compte bloqué pendant encore ${minutes} minute(s).`,
      );
    }

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      if (user) await this.enregistrerEchec(user.id, user.tentativesEchouees, ip);
      // Message identique dans les deux cas : ne jamais révéler si l'adresse
      // correspond à un compte existant.
      throw new UnauthorizedException('Identifiants incorrects');
    }
    if (!user.actif) {
      throw new UnauthorizedException('Compte désactivé, contactez l’administrateur');
    }

    if (user.tentativesEchouees > 0 || user.verrouilleJusqua) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { tentativesEchouees: 0, verrouilleJusqua: null },
      });
    }

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', entite: 'User', entiteId: user.id, ip },
    });

    const { password, ...safe } = user;
    return {
      token: await this.jwt.signAsync({ sub: user.id, role: user.role }),
      user: { ...safe, enseignantId: user.enseignant?.id ?? null },
    };
  }

  /** Un échec de plus ; au seuil, le compte se verrouille et l'incident est tracé. */
  private async enregistrerEchec(userId: string, echecs: number, ip?: string) {
    const total = echecs + 1;
    const verrouille = total >= ECHECS_AVANT_VERROUILLAGE;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tentativesEchouees: verrouille ? 0 : total,
        verrouilleJusqua: verrouille
          ? new Date(Date.now() + DUREE_VERROUILLAGE_MIN * 60_000)
          : null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: verrouille ? 'LOGIN_VERROUILLAGE' : 'LOGIN_ECHEC',
        entite: 'User',
        entiteId: userId,
        ip,
        details: verrouille
          ? `Compte verrouillé ${DUREE_VERROUILLAGE_MIN} min après ${ECHECS_AVANT_VERROUILLAGE} échecs`
          : `Tentative échouée ${total}/${ECHECS_AVANT_VERROUILLAGE}`,
      },
    });
  }

  async profil(current: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: current.id },
      include: {
        departement: true,
        enseignant: { include: { departement: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    const { password, ...safe } = user;
    return { ...safe, enseignantId: user.enseignant?.id ?? null };
  }

  async changePassword(current: AuthUser, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: current.id } });
    if (!user || !(await bcrypt.compare(dto.ancien, user.password))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(dto.nouveau, 10),
        // Coupe tous les jetons déjà émis : si le mot de passe a été changé
        // parce qu'il avait fuité, les sessions ouvertes doivent tomber.
        motDePasseModifieLe: new Date(),
        tentativesEchouees: 0,
        verrouilleJusqua: null,
      },
    });
    return { message: 'Mot de passe modifié' };
  }
}
