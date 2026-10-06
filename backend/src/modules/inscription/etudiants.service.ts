import { QueryDto } from '../../common/dto';
/**
 * Étudiants : le registre central dont dépendent tous les autres modules.
 * Matricule séquentiel par année ("2026-0004"), jeton QR resto généré à la
 * création, compte portail (User role ETUDIANT) rattaché sur demande.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { toDateOnly } from '../../common/utils';
import { CreateEtudiantDto, UpdateEtudiantDto } from './inscription.dto';
import { prochainNumeroTx } from '../../common/numero';

export const ETUDIANT_INCLUDE = {
  user: { select: { id: true, email: true, actif: true } },
  _count: { select: { inscriptions: true, paiements: true } },
  inscriptions: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    include: { promotion: true },
  },
} satisfies Prisma.EtudiantInclude;

/** Champs du tableau départemental : pas d’adresse, date de naissance ni dossier complet. */
const ETUDIANT_DEPARTEMENT_SELECT = {
  id: true,
  matricule: true,
  nom: true,
  prenom: true,
  sexe: true,
  telephone: true,
  email: true,
  actif: true,
  user: { select: { id: true, email: true, actif: true } },
  _count: { select: { inscriptions: true } },
  inscriptions: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    select: {
      promotion: {
        select: { id: true, nom: true, niveau: true, filiere: { select: { code: true, nom: true } } },
      },
    },
  },
} satisfies Prisma.EtudiantSelect;

/** "2026-0001" — INE du candidat, année du libellé scolaire (2025-2026 → 2026). */
export async function prochainMatricule(
  tx: Prisma.TransactionClient,
  annee: string,
): Promise<string> {
  return prochainNumeroTx(tx, 'etudiant', 'matricule', `${annee}-`, 4);
}

/** "INS-2026-00042" — dossier d'inscription. */
export async function prochainNumeroInscription(
  tx: Prisma.TransactionClient,
  annee: string,
): Promise<string> {
  return prochainNumeroTx(tx, 'inscription', 'numero', `INS-${annee}-`, 5);
}

/** "PAY-2026-00001" — transaction de paiement. */
export async function prochainNumeroPaiement(
  tx: Prisma.TransactionClient,
  annee: string,
): Promise<string> {
  return prochainNumeroTx(tx, 'paiement', 'reference', `PAY-${annee}-`, 5);
}

/** Année portée par les numéros : fin du libellé scolaire, sinon année civile. */
export function anneeNumero(libelleAnnee?: string | null): string {
  const fin = libelleAnnee?.split('-')[1]?.trim();
  if (fin && /^\d{4}$/.test(fin)) return fin;
  return String(new Date().getFullYear());
}

@Injectable()
export class EtudiantsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'etudiant', {
      searchFields: ['nom', 'prenom', 'matricule', 'telephone', 'email'],
      orderBy: [{ matricule: 'desc' }],
      include: ETUDIANT_INCLUDE,
      omit: { qrRestoToken: true },
      label: "Étudiant",
    });
  }

  private lecture(user: AuthUser): CrudService {
    if (user.role === Role.CHEF_DEPARTEMENT) return new CrudService(this.prisma, 'etudiant', {
      searchFields: ['nom', 'prenom', 'matricule', 'telephone', 'email'], orderBy: [{ matricule: 'desc' }],
      select: ETUDIANT_DEPARTEMENT_SELECT, label: 'Étudiant',
    });
    if (user.role !== Role.ENSEIGNANT) return this;
    return new CrudService(this.prisma, 'etudiant', {
      searchFields: ['nom', 'prenom', 'matricule'], orderBy: [{ matricule: 'desc' }],
      select: { id: true, matricule: true, nom: true, prenom: true, sexe: true, actif: true }, label: 'Étudiant',
    });
  }

  private perimetre(user: AuthUser) {
    if (user.role === Role.ETUDIANT) return { id: user.etudiantId ?? '__aucun__' };
    if (user.role === Role.CHEF_DEPARTEMENT) return {
      inscriptions: { some: { promotion: { filiere: { departementId: user.departementId ?? '__aucun__' } } } },
    };
    if (user.role === Role.ENSEIGNANT) return {
      travauxEncadres: { some: { encadrantId: user.enseignantId ?? '__aucun__' } },
    };
    return {};
  }

  listePour(query: QueryDto, filters: Record<string, unknown>, user: AuthUser) {
    return this.lecture(user).findAll(query, { AND: [filters, this.perimetre(user)] });
  }

  async detailPour(id: string, user: AuthUser) {
    const result = await this.lecture(user).findAll({ pageSize: 1 }, { AND: [{ id }, this.perimetre(user)] });
    if (!result.data[0]) throw new NotFoundException();
    return result.data[0];
  }

  /** Jeton encodé dans le QR « carte resto » — aléatoire, unique, jamais devinable. */
  nouveauQrResto(): string {
    return `UP-RESTO-${randomBytes(12).toString('base64url')}`;
  }

  /**
   * Création avec matricule et QR automatiques. `creerCompte` ouvre aussi le
   * compte portail (User role ETUDIANT) rattaché à la fiche. Deux créations
   * simultanées tentent le même matricule : la contrainte @unique départage,
   * la création recommence avec le suivant.
   */
  async creer(dto: CreateEtudiantDto, user: AuthUser | null, libelleAnnee?: string | null) {
    const { creerCompte = false, motDePasse, ...donnees } = dto;
    if (creerCompte) {
      if (!donnees.email) {
        throw new BadRequestException(I18nContext.current()!.t('inscription.l_e_mail_est_requis_pour_creer_le_compte_etudiant'));
      }
      if (!motDePasse) {
        throw new BadRequestException(I18nContext.current()!.t('inscription.le_mot_de_passe_est_requis_pour_creer_le_compte_etudiant'));
      }
    }

    const annee = anneeNumero(libelleAnnee);
    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const etudiant = await this.prisma.$transaction(async (tx) => {
          let compte: { id: string } | null = null;
          if (creerCompte) {
            const existant = await tx.user.findUnique({ where: { email: donnees.email } });
            if (existant) {
              throw new ConflictException(I18nContext.current()!.t('inscription.un_compte_existe_deja_avec_cet_e_mail'));
            }
            compte = await tx.user.create({
              data: {
                email: donnees.email!,
                nom: donnees.nom,
                prenom: donnees.prenom,
                telephone: donnees.telephone ?? null,
                role: Role.ETUDIANT,
                password: await bcrypt.hash(motDePasse!, 10),
              },
              select: { id: true },
            });
          }
          const etudiant = await tx.etudiant.create({
            data: {
              ...donnees,
              ...(donnees.dateNaissance
                ? { dateNaissance: toDateOnly(donnees.dateNaissance) }
                : {}),
              matricule: await prochainMatricule(tx, annee),
              qrRestoToken: this.nouveauQrResto(),
              userId: compte?.id ?? null,
            },
            include: ETUDIANT_INCLUDE,
          });
          await tx.auditLog.create({
            data: {
              userId: user?.id,
              action: 'ETUDIANT_CREE',
              entite: 'Etudiant',
              entiteId: etudiant.id,
              details: JSON.stringify({ avant: null, apres: this.instantaneAudit(etudiant) }),
            },
          });
          return etudiant;
        });
        return etudiant;
      } catch (e: any) {
        if (e instanceof ConflictException) throw e;
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(I18nContext.current()!.t('inscription.matricule_temporairement_indisponible_reessayez'));
  }

  async modifier(id: string, dto: UpdateEtudiantDto, user: AuthUser) {
    const { creerCompte = false, motDePasse, ...donnees } = dto;
    return this.prisma.$transaction(async (tx) => {
      const actuel: any = await tx.etudiant.findUnique({ where: { id } });
      if (!actuel) throw new NotFoundException();

      let compteId = actuel.userId ?? null;
      if (creerCompte && !compteId) {
        const email = donnees.email ?? actuel.email;
        if (!email) throw new BadRequestException(I18nContext.current()!.t('inscription.l_e_mail_est_requis_pour_creer_le_compte_etudiant'));
        if (!motDePasse) {
          throw new BadRequestException(I18nContext.current()!.t('inscription.le_mot_de_passe_est_requis_pour_creer_le_compte_etudiant'));
        }
        const existant = await tx.user.findUnique({ where: { email } });
        if (existant) throw new ConflictException(I18nContext.current()!.t('inscription.un_compte_existe_deja_avec_cet_e_mail'));
        const compte = await tx.user.create({
          data: {
            email,
            nom: donnees.nom ?? actuel.nom,
            prenom: donnees.prenom ?? actuel.prenom,
            telephone: donnees.telephone ?? actuel.telephone ?? null,
            role: Role.ETUDIANT,
            password: await bcrypt.hash(motDePasse!, 10),
          },
          select: { id: true },
        });
        compteId = compte.id;
      }

      const maj: any = await tx.etudiant.update({
        where: { id },
        data: {
          ...donnees,
          ...(donnees.dateNaissance ? { dateNaissance: toDateOnly(donnees.dateNaissance) } : {}),
          qrRestoToken: actuel.qrRestoToken ?? this.nouveauQrResto(),
          userId: compteId,
        },
        include: ETUDIANT_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'ETUDIANT_MODIFIE',
          entite: 'Etudiant',
          entiteId: id,
          details: JSON.stringify({
            avant: this.instantaneAudit(actuel),
            apres: this.instantaneAudit(maj),
            champsModifies: Object.keys(donnees),
          }),
        },
      });
      return maj;
    });
  }

  /** État utile à l'audit sans coordonnées, date de naissance ni données de compte. */
  private instantaneAudit(etudiant: any) {
    return {
      matricule: etudiant.matricule,
      nom: etudiant.nom,
      prenom: etudiant.prenom,
      sexe: etudiant.sexe ?? null,
      actif: etudiant.actif,
    };
  }

  /**
   * « Suppression » : la fiche ne s'efface jamais (elle porte paiements,
   * notes, attestations…), elle se désactive. Le portail étudiant refuse
   * alors l'accès au compte rattaché.
   */
  async remove(id: string, user?: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      const avant: any = await tx.etudiant.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException();
      const apres: any = await tx.etudiant.update({
        where: { id },
        data: { actif: false },
        include: ETUDIANT_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          userId: user?.id,
          action: 'ETUDIANT_DESACTIVE',
          entite: 'Etudiant',
          entiteId: id,
          details: JSON.stringify({
            avant: this.instantaneAudit(avant),
            apres: this.instantaneAudit(apres),
          }),
        },
      });
    });
    return { id };
  }
}
