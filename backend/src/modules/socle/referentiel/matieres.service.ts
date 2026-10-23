/** Matières : catalogue et volumes horaires. */

import { Injectable, NotFoundException } from '@nestjs/common';
import { CrudService, supprimerOuConflit } from '../../../common/crud.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { estChefDeDepartement, exigerPerimetre, filtreDepartement } from '../../../common/perimetre';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { CreateMatiereDto, UpdateMatiereDto } from './matieres.dto';

@Injectable()
export class MatieresService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'matiere', {
      searchFields: ['code', 'intitule'],
      orderBy: { intitule: 'asc' },
      include: { departement: true },
      label: 'Matière',
    });
  }

  private instantaneAudit(matiere: any) {
    return {
      id: matiere.id,
      code: matiere.code,
      intitule: matiere.intitule,
      volumeHoraireTotal: matiere.volumeHoraireTotal,
      credits: matiere.credits,
      departementId: matiere.departementId,
    };
  }

  async creer(dto: CreateMatiereDto, acteur?: AuthUser) {
    if (acteur) exigerPerimetre(acteur, dto.departementId);
    return this.prisma.$transaction(async (tx) => {
      const creee = await tx.matiere.create({ data: dto, include: { departement: true } });
      await journaliser(tx, acteur ?? null, 'MATIERE_CREEE', 'Matiere', creee.id, {
        avant: null,
        apres: this.instantaneAudit(creee),
        champsModifies: Object.keys(dto),
      });
      return creee;
    });
  }

  async modifier(id: string, dto: UpdateMatiereDto, acteur?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.matiere.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('common.notFound'));
      if (acteur) {
        exigerPerimetre(acteur, avant.departementId);
        exigerPerimetre(acteur, dto.departementId ?? avant.departementId);
      }
      const maj = await tx.matiere.update({ where: { id }, data: dto, include: { departement: true } });
      await journaliser(tx, acteur ?? null, 'MATIERE_MODIFIEE', 'Matiere', id, {
        avant: this.instantaneAudit(avant),
        apres: this.instantaneAudit(maj),
        champsModifies: Object.keys(dto),
      });
      return maj;
    });
  }

  async supprimer(id: string, acteur?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.matiere.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('common.notFound'));
      await supprimerOuConflit(() => tx.matiere.delete({ where: { id } }), 'referentiel.matiere_referenced_delete');
      await journaliser(tx, acteur ?? null, 'MATIERE_SUPPRIMEE', 'Matiere', id, {
        avant: this.instantaneAudit(avant),
        apres: null,
      });
      return { id };
    });
  }

  /** Vérifie qu'une UE existe et reste dans le périmètre du demandeur. */
  async trouverPerimetre(id: string, user: AuthUser) {
    if (estChefDeDepartement(user)) {
      const matiere = await this.prisma.matiere.findFirst({
        where: { id, ...filtreDepartement(user) },
        include: { departement: true },
      });
      if (!matiere) throw new NotFoundException(t('common.notFound'));
      return matiere;
    }
    const matiere = await this.findOne(id);
    return matiere;
  }

  async modifierPerimetre(id: string, dto: UpdateMatiereDto, user: AuthUser) {
    const actuelle = await this.trouverPerimetre(id, user);
    exigerPerimetre(user, dto.departementId ?? actuelle.departementId);
    return this.modifier(id, dto, user);
  }
}
