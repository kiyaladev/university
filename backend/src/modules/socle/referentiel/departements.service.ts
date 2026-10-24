/** Départements : l’ossature académique. */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Departement } from '@prisma/client';
import { CrudService, supprimerOuConflit } from '../../../common/crud.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { CreateDepartementDto, UpdateDepartementDto } from './departements.dto';

/** Relations chargées avec un département : le nombre d'enseignants et de filières. */
const DEPARTEMENT_INCLUDE = { _count: { select: { enseignants: true, filieres: true } } } as const;

@Injectable()
export class DepartementsService extends CrudService<
  Prisma.DepartementGetPayload<{ include: typeof DEPARTEMENT_INCLUDE }>
> {
  constructor(prisma: PrismaService) {
    super(prisma, 'departement', {
      searchFields: ['code', 'nom', 'faculte'],
      orderBy: { nom: 'asc' },
      include: DEPARTEMENT_INCLUDE,
      label: 'Département',
    });
  }

  listePublique() {
    return this.prisma.departement.findMany({
      select: { id: true, code: true, nom: true, faculte: true },
      orderBy: { nom: 'asc' },
    });
  }

  private instantaneAudit(departement: Departement) {
    return { id: departement.id, code: departement.code, nom: departement.nom, faculte: departement.faculte };
  }

  async creer(dto: CreateDepartementDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const departement = await tx.departement.create({ data: dto, include: DEPARTEMENT_INCLUDE });
        await journaliser(tx, user ?? null, 'DEPARTEMENT_CREE', 'Departement', departement.id, {
          avant: null,
          apres: this.instantaneAudit(departement),
          champsModifies: Object.keys(dto),
        });
        return departement;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async modifier(id: string, dto: UpdateDepartementDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const avant = await tx.departement.findUnique({ where: { id } });
        if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Département' }));
        const apres = await tx.departement.update({ where: { id }, data: dto, include: DEPARTEMENT_INCLUDE });
        await journaliser(tx, user ?? null, 'DEPARTEMENT_MODIFIE', 'Departement', id, {
          avant: this.instantaneAudit(avant),
          apres: this.instantaneAudit(apres),
          champsModifies: Object.keys(dto),
        });
        return apres;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Un département qui porte encore des données métier ne peut pas s'effacer. */
  async supprimer(id: string, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const departement = await tx.departement.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            nom: true,
            _count: {
              select: {
                membres: true,
                enseignants: true,
                filieres: true,
                matieres: true,
                documents: true,
                equipementsPatrimoine: true,
                reclamations: true,
                elections: true,
              },
            },
          },
        });
        if (!departement) throw new NotFoundException(t('common.notFound'));
        if (Object.values(departement._count).some((count) => count > 0)) {
          throw new ConflictException(t('referentiel.departement_referenced_delete'));
        }
        await supprimerOuConflit(
          () => tx.departement.delete({ where: { id } }),
          'referentiel.departement_referenced_delete',
        );
        await journaliser(tx, user ?? null, 'DEPARTEMENT_SUPPRIME', 'Departement', id, {
          avant: { id, code: departement.code, nom: departement.nom },
          apres: null,
        });
        return { id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
