import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { t } from '../../common/i18n';
import { motDePasseDemo } from '../../common/demo-accounts';
import { journaliser } from '../../common/audit';

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
      select: {
        id: true,
        email: true,
        password: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        tentativesEchouees: true,
        verrouilleJusqua: true,
        motDePasseModifieLe: true,
        departementId: true,
        departement: { select: { id: true, code: true, nom: true } },
        enseignant: { select: { id: true } },
      },
    });

    if (user?.verrouilleJusqua && user.verrouilleJusqua > new Date()) {
      const minutes = Math.ceil((user.verrouilleJusqua.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(t('auth.trop_de_tentatives_compte_bloque', { minutes }));
    }

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      if (user) await this.enregistrerEchec(user.id, ip);
      // Message identique dans les deux cas : ne jamais révéler si l'adresse
      // correspond à un compte existant.
      throw new UnauthorizedException(t('auth.identifiants_incorrects'));
    }
    if (!user.actif) {
      throw new UnauthorizedException(t('auth.compte_desactive_contactez_l_administrateur'));
    }
    if (process.env.NODE_ENV === 'production' && (await motDePasseDemo(user.password))) {
      throw new UnauthorizedException(t('auth.identifiants_incorrects'));
    }

    // Remise à zéro du compteur et trace LOGIN forment un seul fait : dans une
    // transaction, pour qu'un journal perdu ne laisse pas un compte définitivement
    // verrouillé (ou, à l'inverse, un compteur gelé après une connexion réussie).
    await this.prisma.$transaction(async (tx) => {
      if (user.tentativesEchouees > 0 || user.verrouilleJusqua) {
        await tx.user.update({
          where: { id: user.id },
          data: { tentativesEchouees: 0, verrouilleJusqua: null },
        });
      }

      await tx.auditLog.create({
        data: { userId: user.id, action: 'LOGIN', entite: 'User', entiteId: user.id, ip },
      });
    });

    return {
      token: await this.jwt.signAsync({ sub: user.id, role: user.role }),
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        telephone: user.telephone,
        role: user.role,
        actif: user.actif,
        departementId: user.departementId,
        departement: user.departement
          ? {
              id: user.departement.id,
              code: user.departement.code,
              nom: user.departement.nom,
            }
          : null,
        enseignantId: user.enseignant?.id ?? null,
      },
    };
  }

  /** Un échec de plus ; au seuil, le compte se verrouille et l'incident est tracé. */
  private async enregistrerEchec(userId: string, ip?: string) {
    // Compteur/verrou et trace partent ensemble : sans cela, un échec d'écriture
    // du journal laisserait les tentatives s'incrémenter sans trace — donc un
    // verrouillage invisible, capable de bloquer un compte sans justificatif.
    await this.prisma.$transaction(async (tx) => {
      // L'incrément est confié à la base (`tentativesEchouees + 1`) et non
      // recalculé ici depuis une lecture antérieure : plusieurs échecs
      // simultanés lisent tous la même valeur, repartiraient tous du même
      // `echecs + 1` et l'un d'eux écraserait les autres — compteur gelé, donc
      // verrouillage repoussé d'autant.
      const apres = await tx.user.update({
        where: { id: userId },
        data: { tentativesEchouees: { increment: 1 } },
        select: { tentativesEchouees: true },
      });

      // Seul le total réellement écrit décide du verrou : c'est lui qui compte
      // tous les échecs en vol, pas la lecture faite avant.
      const total = apres.tentativesEchouees;
      const verrouille = total >= ECHECS_AVANT_VERROUILLAGE;

      // Sous le seuil, `verrouilleJusqua` n'est pas réécrit : une valeur
      // périmée n'ouvre rien (la connexion ne se poursuit qu'au-delà de cette
      // date), et surtout un échec déjà parti avant le verrouillage ne peut
      // pas l'effacer au passage.
      if (verrouille) {
        await tx.user.update({
          where: { id: userId },
          data: {
            tentativesEchouees: 0,
            verrouilleJusqua: new Date(Date.now() + DUREE_VERROUILLAGE_MIN * 60_000),
          },
        });
      }

      await tx.auditLog.create({
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
    });
  }

  async profil(current: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: current.id },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        departementId: true,
        departement: { select: { id: true, code: true, nom: true } },
        enseignant: { select: { id: true } },
      },
    });
    if (!user) throw new UnauthorizedException(t('auth.accountNotFound'));
    return {
      ...user,
      departement: user.departement
        ? {
            id: user.departement.id,
            code: user.departement.code,
            nom: user.departement.nom,
          }
        : null,
      enseignantId: user.enseignant?.id ?? null,
    };
  }

  async changePassword(current: AuthUser, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: current.id } });
    if (!user || !(await bcrypt.compare(dto.ancien, user.password))) {
      throw new UnauthorizedException(t('auth.mot_de_passe_actuel_incorrect'));
    }
    const password = await bcrypt.hash(dto.nouveau, 10);
    await this.prisma.$transaction(async (tx) => {
      const maj = await tx.user.updateMany({
        where: { id: user.id, password: user.password },
        data: {
          password,
          // Coupe tous les jetons déjà émis : si le mot de passe a été changé
          // parce qu'il avait fuité, les sessions ouvertes doivent tomber.
          motDePasseModifieLe: new Date(),
          tentativesEchouees: 0,
          verrouilleJusqua: null,
        },
      });
      if (maj.count !== 1) {
        throw new ConflictException(t('auth.mot_de_passe_modifie_concurrence_reessayez'));
      }
      await journaliser(tx, user, 'MOT_DE_PASSE_MODIFIE', 'User', user.id, { sessionsRevoquees: true });
    });
    return { message: 'Mot de passe modifié' };
  }
}
