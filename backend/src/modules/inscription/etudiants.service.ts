/**
 * Étudiants : le registre central dont dépendent tous les autres modules.
 * Matricule séquentiel par année ("2026-0004"), jeton QR resto généré à la
 * création, compte portail (User role ETUDIANT) rattaché sur demande.
 */
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { toDateOnly } from '../../common/utils';
import { CreateEtudiantDto, UpdateEtudiantDto } from './inscription.dto';

export const ETUDIANT_INCLUDE = {
  user: { select: { id: true, email: true, actif: true } },
  _count: { select: { inscriptions: true, paiements: true } },
  inscriptions: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    include: { promotion: true },
  },
} satisfies Prisma.EtudiantInclude;

/** Numéro séquentiel "PRÉFIXE-NNNNN" lu dans la base (pas de table de séquence). */
async function prochainNumero(
  delegate: any,
  champ: string,
  prefixe: string,
  largeur: number,
): Promise<string> {
  const existantes = await delegate.findMany({
    where: { [champ]: { startsWith: prefixe } },
    select: { [champ]: true },
  });
  const max = existantes.reduce((m: number, e: any) => {
    const n = Number(e[champ].slice(prefixe.length));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefixe}${String(max + 1).padStart(largeur, '0')}`;
}

/** "2026-0001" — INE du candidat, année du libellé scolaire (2025-2026 → 2026). */
export async function prochainMatricule(
  tx: Prisma.TransactionClient,
  annee: string,
): Promise<string> {
  return prochainNumero(tx.etudiant, 'matricule', `${annee}-`, 4);
}

/** "INS-2026-00042" — dossier d'inscription. */
export async function prochainNumeroInscription(
  tx: Prisma.TransactionClient,
  annee: string,
): Promise<string> {
  return prochainNumero(tx.inscription, 'numero', `INS-${annee}-`, 5);
}

/** "PAY-2026-00001" — transaction de paiement. */
export async function prochainNumeroPaiement(
  tx: Prisma.TransactionClient,
  annee: string,
): Promise<string> {
  return prochainNumero(tx.paiement, 'reference', `PAY-${annee}-`, 5);
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
      label: "Étudiant",
    });
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
        throw new BadRequestException('L’e-mail est requis pour créer le compte étudiant');
      }
      if (!motDePasse) {
        throw new BadRequestException('Le mot de passe est requis pour créer le compte étudiant');
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
              throw new ConflictException('Un compte existe déjà avec cet e-mail');
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
          return tx.etudiant.create({
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
        });

        await this.prisma.auditLog.create({
          data: {
            userId: user?.id,
            action: 'ETUDIANT_CREE',
            entite: 'Etudiant',
            entiteId: etudiant.id,
            details: `${etudiant.matricule} — ${etudiant.nom} ${etudiant.prenom}`,
          },
        });
        return etudiant;
      } catch (e: any) {
        if (e instanceof ConflictException) throw e;
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException('Matricule temporairement indisponible, réessayez');
  }

  async modifier(id: string, dto: UpdateEtudiantDto, user: AuthUser) {
    const { creerCompte = false, motDePasse, ...donnees } = dto;
    const actuel: any = await this.findOne(id);

    let compteId = actuel.userId ?? null;
    if (creerCompte && !compteId) {
      const email = donnees.email ?? actuel.email;
      if (!email) throw new BadRequestException('L’e-mail est requis pour créer le compte étudiant');
      if (!motDePasse) {
        throw new BadRequestException('Le mot de passe est requis pour créer le compte étudiant');
      }
      const existant = await this.prisma.user.findUnique({ where: { email } });
      if (existant) throw new ConflictException('Un compte existe déjà avec cet e-mail');
      const compte = await this.prisma.user.create({
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

    const maj = await this.prisma.etudiant.update({
      where: { id },
      data: {
        ...donnees,
        ...(donnees.dateNaissance ? { dateNaissance: toDateOnly(donnees.dateNaissance) } : {}),
        qrRestoToken: actuel.qrRestoToken ?? this.nouveauQrResto(),
        userId: compteId,
      },
      include: ETUDIANT_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ETUDIANT_MODIFIE',
        entite: 'Etudiant',
        entiteId: id,
        details: `${maj.matricule} — ${maj.nom} ${maj.prenom}`,
      },
    });
    return maj;
  }

  /**
   * « Suppression » : la fiche ne s'efface jamais (elle porte paiements,
   * notes, attestations…), elle se désactive. Le portail étudiant refuse
   * alors l'accès au compte rattaché.
   */
  async remove(id: string, user?: AuthUser) {
    await this.findOne(id);
    const etudiant = await this.prisma.etudiant.update({
      where: { id },
      data: { actif: false },
      include: ETUDIANT_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user?.id,
        action: 'ETUDIANT_DESACTIVE',
        entite: 'Etudiant',
        entiteId: id,
        details: `${etudiant.matricule} — ${etudiant.nom} ${etudiant.prenom}`,
      },
    });
    return { id };
  }
}