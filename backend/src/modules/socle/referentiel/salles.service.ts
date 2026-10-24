/** Salles : inventaire, capacité et QR de pointage. */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Role, type Salle } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { CrudService, supprimerOuConflit } from '../../../common/crud.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { QueryDto } from '../../../common/dto';
import { AuthUser } from '../../../common/decorators';
import { t } from '../../../common/i18n';
import { paginer, pagine } from '../../../common/pagination';
import { journaliser } from '../../../common/audit';
import { CreateSalleDto, UpdateSalleDto } from './salles.dto';

@Injectable()
export class SallesService extends CrudService<Salle> {
  constructor(prisma: PrismaService) {
    super(prisma, 'salle', {
      searchFields: ['code', 'nom', 'batiment'],
      orderBy: { code: 'asc' },
      sortFields: ['code', 'nom', 'capacite'],
      label: 'Salle',
    });
  }

  private nouveauToken() {
    return `UP-${randomBytes(9).toString('base64url')}`;
  }

  /** L'instantané ignore le jeton de capacité et les coordonnées précises. */
  private instantaneAudit(salle: Salle) {
    return {
      id: salle.id,
      code: salle.code,
      batimentRenseigne: Boolean(salle.batiment),
      capacite: salle.capacite,
      actif: salle.actif,
      qrConfigure: Boolean(salle.qrToken),
      coordonneesConfigurees: salle.latitude != null && salle.longitude != null,
      rayonConfigure: salle.rayonMetres != null,
    };
  }

  /** Les coordonnées et le jeton QR ne sont nécessaires qu'à la gestion des salles. */
  private projectionPour(user: AuthUser) {
    if (user.role === Role.ADMIN || user.role === Role.SCOLARITE) return undefined;
    return {
      id: true,
      code: true,
      nom: true,
      batiment: true,
      capacite: true,
      actif: true,
    };
  }

  async listePour(query: QueryDto, user: AuthUser) {
    const select = this.projectionPour(user);
    if (!select) return super.lister(query);

    const pagination = paginer(query);
    const fullWhere = this.searchWhere(query.search);
    const [data, total] = await Promise.all([
      this.delegate.findMany({
        where: fullWhere,
        select,
        orderBy: this.orderByDe(query),
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.delegate.count({ where: fullWhere }),
    ]);
    return pagine(data, total, pagination);
  }

  async fichePour(id: string, user: AuthUser) {
    const select = this.projectionPour(user);
    if (!select) return super.lire(id);
    const salle = await this.delegate.findUnique({ where: { id }, select });
    if (!salle) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Salle' }));
    return salle;
  }

  async creer(dto: CreateSalleDto, acteur?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const creee = await tx.salle.create({ data: { ...dto, qrToken: this.nouveauToken() } });
      await journaliser(tx, acteur ?? null, 'SALLE_CREEE', 'Salle', creee.id, {
        avant: null,
        apres: this.instantaneAudit(creee),
        champsModifies: Object.keys(dto),
      });
      return creee;
    });
  }

  async modifier(id: string, dto: UpdateSalleDto, acteur?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.salle.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Salle' }));
      const maj = await tx.salle.update({ where: { id }, data: dto });
      await journaliser(tx, acteur ?? null, 'SALLE_MODIFIEE', 'Salle', id, {
        avant: this.instantaneAudit(avant),
        apres: this.instantaneAudit(maj),
        champsModifies: Object.keys(dto),
      });
      return maj;
    });
  }

  /** Régénère le QR (affiche invalidée, ex. affiche photographiée/diffusée). */
  async regenererQr(id: string, acteur?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.salle.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Salle' }));
      const maj = await tx.salle.update({ where: { id }, data: { qrToken: this.nouveauToken() } });
      await journaliser(tx, acteur ?? null, 'SALLE_QR_REGENERE', 'Salle', id, {
        avant: this.instantaneAudit(avant),
        apres: this.instantaneAudit(maj),
        champsModifies: ['qrToken'],
      });
      return maj;
    });
  }

  /** Une salle où des séances ou des réservations sont posées se garde. */
  async supprimer(id: string, acteur?: AuthUser) {
    return supprimerOuConflit(
      () =>
        this.prisma.$transaction(async (tx) => {
          const avant = await tx.salle.findUnique({ where: { id } });
          if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Salle' }));
          await tx.salle.delete({ where: { id } });
          await journaliser(tx, acteur ?? null, 'SALLE_SUPPRIMEE', 'Salle', id, {
            avant: this.instantaneAudit(avant),
            apres: null,
          });
          return { id };
        }),
      'referentiel.salle_referenced_delete',
    );
  }
}
