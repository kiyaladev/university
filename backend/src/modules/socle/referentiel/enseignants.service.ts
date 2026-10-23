/** Enseignants : annuaire, statut et périmètre. */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CrudService, supprimerOuConflit } from '../../../common/crud.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { estChefDeDepartement, exigerPerimetre, filtreDepartement } from '../../../common/perimetre';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { CreateEnseignantDto, EnseignantQueryDto, UpdateEnseignantDto } from './enseignants.dto';

export const ENSEIGNANT_LECTURE_MINIMALE = {
  id: true,
  matricule: true,
  nom: true,
  prenom: true,
  grade: true,
  statut: true,
  actif: true,
  departementId: true,
  departement: { select: { id: true, nom: true } },
} as const;

@Injectable()
export class EnseignantsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'enseignant', {
      searchFields: ['nom', 'prenom', 'matricule', 'email'],
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      include: {
        departement: true,
        user: { select: { id: true, email: true, actif: true } },
      },
      label: 'Enseignant',
    });
  }

  /** Exclut coordonnées, rémunération, PIN et gabarit biométrique. */
  private instantaneAudit(enseignant: any) {
    return {
      id: enseignant.id,
      statut: enseignant.statut,
      actif: enseignant.actif,
      departementId: enseignant.departementId,
      compteLie: Boolean(enseignant.userId),
    };
  }

  private lecture(user: AuthUser): CrudService {
    if (([Role.ETUDIANT, Role.ENSEIGNANT, Role.CONTROLEUR, Role.CHEF_DEPARTEMENT] as Role[]).includes(user.role)) {
      return new CrudService(this.prisma, 'enseignant', {
        searchFields: ['nom', 'prenom', 'matricule'],
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        select: ENSEIGNANT_LECTURE_MINIMALE,
        label: 'Enseignant',
      });
    }
    return this;
  }

  listePour(query: EnseignantQueryDto, user: AuthUser) {
    return this.lecture(user).findAll(query, {
      ...(estChefDeDepartement(user)
        ? filtreDepartement(user)
        : query.departementId
          ? { departementId: query.departementId }
          : {}),
      ...(query.statut ? { statut: query.statut } : {}),
    });
  }

  async detailPour(id: string, user: AuthUser) {
    if (estChefDeDepartement(user)) {
      const enseignant = await this.prisma.enseignant.findFirst({
        where: { id, ...filtreDepartement(user) },
        select: ENSEIGNANT_LECTURE_MINIMALE,
      });
      if (!enseignant) throw new NotFoundException(t('common.notFound'));
      return enseignant;
    }
    return this.lecture(user).findOne(id);
  }

  /**
   * La lecture était bornée au département du chef de département, l'écriture ne
   * l'était pas : `PUT /enseignants/:id` touchait n'importe quel enseignant et
   * acceptait `departementId` dans le corps, ce qui permettait de sortir un
   * enseignant de son périmètre — ou de le désactiver, ou de changer son
   * adresse de courriel. L'écriture passe maintenant par le même contrôle.
   */
  async creerPour(dto: CreateEnseignantDto, user: AuthUser) {
    exigerPerimetre(user, dto.departementId);
    return this.prisma.$transaction(async (tx) => {
      const cree = await tx.enseignant.create({ data: dto, include: this.options.include });
      await journaliser(tx, user, 'ENSEIGNANT_CREE', 'Enseignant', cree.id, {
        avant: null,
        apres: this.instantaneAudit(cree),
        champsModifies: Object.keys(dto),
      });
      return cree;
    });
  }

  async modifierPour(id: string, dto: UpdateEnseignantDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const cible = await tx.enseignant.findUnique({ where: { id } });
      if (!cible) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Enseignant' }));
      // Le périmètre est revérifié dans la transaction, après la lecture de l'état courant.
      exigerPerimetre(user, cible.departementId);
      exigerPerimetre(user, dto.departementId ?? cible.departementId);
      const maj = await tx.enseignant.update({ where: { id }, data: dto, include: this.options.include });
      await journaliser(tx, user, 'ENSEIGNANT_MODIFIE', 'Enseignant', id, {
        avant: this.instantaneAudit(cible),
        apres: this.instantaneAudit(maj),
        champsModifies: Object.keys(dto),
      });
      return maj;
    });
  }

  async supprimer(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.enseignant.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Enseignant' }));
      await supprimerOuConflit(
        () => tx.enseignant.delete({ where: { id } }),
        'referentiel.enseignant_referenced_delete',
      );
      await journaliser(tx, user, 'ENSEIGNANT_SUPPRIME', 'Enseignant', id, {
        avant: this.instantaneAudit(avant),
        apres: null,
      });
      return { id };
    });
  }
}
