/** Filières : regroupement de promotions. */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CrudService, supprimerOuConflit } from '../../../common/crud.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { CreateFiliereDto, UpdateFiliereDto } from './filieres.dto';

@Injectable()
export class FilieresService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'filiere', {
      searchFields: ['code', 'nom'],
      orderBy: { nom: 'asc' },
      include: { departement: true },
      label: 'Filière',
    });
  }

  private instantaneAudit(filiere: any) {
    return { id: filiere.id, code: filiere.code, nom: filiere.nom, departementId: filiere.departementId };
  }

  async creer(dto: CreateFiliereDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const filiere = await tx.filiere.create({ data: dto, include: this.options.include });
        await journaliser(tx, user ?? null, 'FILIERE_CREEE', 'Filiere', filiere.id, {
          avant: null,
          apres: this.instantaneAudit(filiere),
          champsModifies: Object.keys(dto),
        });
        return filiere;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async modifier(id: string, dto: UpdateFiliereDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const avant = await tx.filiere.findUnique({ where: { id } });
        if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Filière' }));
        const apres = await tx.filiere.update({ where: { id }, data: dto, include: this.options.include });
        await journaliser(tx, user ?? null, 'FILIERE_MODIFIEE', 'Filiere', id, {
          avant: this.instantaneAudit(avant),
          apres: this.instantaneAudit(apres),
          champsModifies: Object.keys(dto),
        });
        return apres;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Une filière qui porte encore des promotions ne peut pas s'effacer. */
  async supprimer(id: string, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const filiere = await tx.filiere.findUnique({
          where: { id },
          select: { id: true, code: true, nom: true, departementId: true, _count: { select: { promotions: true } } },
        });
        if (!filiere) throw new NotFoundException(t('common.notFound'));
        if (filiere._count.promotions > 0) {
          throw new ConflictException(t('referentiel.filiere_referenced_delete'));
        }
        await supprimerOuConflit(() => tx.filiere.delete({ where: { id } }), 'referentiel.filiere_referenced_delete');
        await journaliser(tx, user ?? null, 'FILIERE_SUPPRIMEE', 'Filiere', id, {
          avant: { id, code: filiere.code, nom: filiere.nom, departementId: filiere.departementId },
          apres: null,
        });
        return { id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
