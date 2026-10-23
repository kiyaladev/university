/** Comptes utilisateurs : création, profils et rôles. */

import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CrudService, supprimerOuConflit } from '../../../common/crud.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './users.dto';

@Injectable()
export class UsersService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'user', {
      searchFields: ['nom', 'prenom', 'email'],
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        departementId: true,
      },
      label: 'Utilisateur',
    });
  }

  private profilSecurise(u: any) {
    return {
      id: u.id,
      email: u.email,
      nom: u.nom,
      prenom: u.prenom,
      telephone: u.telephone,
      role: u.role,
      actif: u.actif,
      departementId: u.departementId,
    };
  }

  /** L'audit des comptes ne conserve ni identité, ni secret, ni verrouillage. */
  private instantaneAudit(u: any) {
    return {
      id: u.id,
      role: u.role,
      actif: u.actif,
      departementId: u.departementId,
      motDePasseConfigure: Boolean(u.password),
    };
  }

  private selectAudit() {
    return { ...this.selectProfil(), password: true };
  }

  async findOne(id: string) {
    return this.profilSecurise(await super.findOne(id));
  }

  async list(query: UserQueryDto) {
    const res = await this.findAll(query, {
      ...(query.role ? { role: query.role } : {}),
      ...(query.departementId ? { departementId: query.departementId } : {}),
    });
    return { ...res, data: res.data.map((u: any) => this.profilSecurise(u)) };
  }

  async creer(dto: CreateUserDto, acteur?: AuthUser) {
    const { password, enseignantId, ...rest } = dto;
    const hash = await bcrypt.hash(password, 10);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { ...rest, email: dto.email.toLowerCase().trim(), password: hash },
        select: this.selectAudit(),
      });
      if (enseignantId) await tx.enseignant.update({ where: { id: enseignantId }, data: { userId: user.id } });
      await journaliser(tx, acteur ?? null, 'UTILISATEUR_CREE', 'Utilisateur', user.id, {
        avant: null,
        apres: this.instantaneAudit(user),
        champsModifies: Object.keys(rest),
      });
      return this.profilSecurise(user);
    });
  }

  async modifier(id: string, dto: UpdateUserDto, acteur?: AuthUser) {
    const { password, enseignantId, ...rest } = dto;
    const hash = password ? await bcrypt.hash(password, 10) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.user.findUnique({ where: { id }, select: this.selectAudit() });
      if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Utilisateur' }));
      const apres = await tx.user.update({
        where: { id },
        data: {
          ...rest,
          ...(dto.email ? { email: dto.email.toLowerCase().trim() } : {}),
          ...(hash
            ? { password: hash, motDePasseModifieLe: new Date(), tentativesEchouees: 0, verrouilleJusqua: null }
            : {}),
        },
        select: this.selectAudit(),
      });
      if (enseignantId) await tx.enseignant.update({ where: { id: enseignantId }, data: { userId: id } });
      await journaliser(tx, acteur ?? null, 'UTILISATEUR_MODIFIE', 'Utilisateur', id, {
        avant: this.instantaneAudit(avant),
        apres: this.instantaneAudit(apres),
        champsModifies: [
          ...Object.keys(rest),
          ...(password ? ['motDePasse'] : []),
          ...(enseignantId ? ['enseignantId'] : []),
        ],
      });
      return this.profilSecurise(apres);
    });
  }

  async supprimer(id: string, acteur?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.user.findUnique({ where: { id }, select: this.selectAudit() });
      if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Utilisateur' }));
      await supprimerOuConflit(() => tx.user.delete({ where: { id } }), 'referentiel.user_referenced_delete');
      await journaliser(tx, acteur ?? null, 'UTILISATEUR_SUPPRIME', 'Utilisateur', id, {
        avant: this.instantaneAudit(avant),
        apres: null,
      });
      return { id };
    });
  }

  private selectProfil() {
    return {
      id: true,
      email: true,
      nom: true,
      prenom: true,
      telephone: true,
      role: true,
      actif: true,
      departementId: true,
    };
  }
}
