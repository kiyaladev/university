/**
 * ### Machine à états des travaux encadrés (PROPOSE → … → SOUTENU)
 *
 * Toute évolution d'état passe par POST /api/travaux-encadres/:id/transition
 * (jamais par la création ni la modification), sauf la soutenance : l'acte
 * « soutenance enregistrée » (POST /api/soutenances) place lui-même le travail
 * en SOUTENU — une défense constatée par le bureau du jury EST l'état terminal.
 *
 * | De            | Vers      | Condition                                                        | Qui            |
 * |---------------|-----------|------------------------------------------------------------------|----------------|
 * | PROPOSE       | VALIDE    | un encadrant est désigné (encadrantId)                           | staff, encadrant|
 * | VALIDE        | EN_COURS  | —                                                                | staff, encadrant |
 * | EN_COURS      | SOUTENU   | rapport rendu ET soutenance enregistrée   (sinon refus expliqué) | staff, encadrant|
 * | PROPOSE/VALIDE/EN_COURS | ABANDONNE | rupture du parcours à tout moment (la soutenance, elle, reste terminale) | staff, encadrant |
 * | ABANDONNE     | PROPOSE   | réactivation d'un dossier abandonné                              | staff |
 * | SOUTENU       | —         | état terminal : aucune transition sortante                      | — |
 *
 * Règles transverses :
 * - jamais de retour en arrière sur la chaîne valorisée (VALIDÉ → PROPOSÉ,
 *   EN_COURS → VALIDÉ… sont refusés) ;
 * - l'enseignant n'agit que sur les travaux qu'il encadre (le sien) ;
 * - chaque transition est tracée dans le journal d'audit, avec la mention de
 *   l'ancien et du nouvel état.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, Role, StatutEncadrement } from '@prisma/client';
import { CrudService } from '../../common/crud.service';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSoutenanceDto,
  CreateTravailDto,
  NoteSoutenanceDto,
  TravailQueryDto,
  UpdateTravailDto,
} from './stages.dto';

/** Rôles « administration » : ils voient et pilotent tous les travaux. */
export const ROLES_PILOTES: Role[] = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE];

export const TRAVAIL_INCLUDE = {
  etudiant: true,
  encadrant: true,
  soutenance: { include: { salle: true, president: true } },
} satisfies Prisma.TravailEncadreInclude;

const TRANSITIONS: Partial<Record<StatutEncadrement, StatutEncadrement[]>> = {
  PROPOSE: [StatutEncadrement.VALIDE, StatutEncadrement.ABANDONNE],
  VALIDE: [StatutEncadrement.EN_COURS, StatutEncadrement.ABANDONNE],
  EN_COURS: [StatutEncadrement.SOUTENU, StatutEncadrement.ABANDONNE],
  ABANDONNE: [StatutEncadrement.PROPOSE],
  SOUTENU: [],
};

@Injectable()
export class StagesService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'travailEncadre', {
      searchFields: ['intitule', 'description', 'entreprise', 'lieu'],
      orderBy: [{ createdAt: 'desc' }],
      include: TRAVAIL_INCLUDE,
      label: 'Travail encadré',
    });
  }

  // ------------------------------------------------------------------
  // Lecture (avec périmètre par rôle)
  // ------------------------------------------------------------------

  /** Périmètre : l'étudiant ne lit que ses travaux, l'enseignant ses encadrements. */
  async liste(query: TravailQueryDto, user: AuthUser) {
    const where: Prisma.TravailEncadreWhereInput = {};

    if (query.statut) where.statut = query.statut;
    if (query.type) where.type = query.type;

    if (user.role === Role.ETUDIANT) {
      where.etudiantId = user.etudiantId ?? '—';
    } else if (user.role === Role.ENSEIGNANT) {
      where.encadrantId = user.enseignantId ?? '—';
    } else if (query.encadrantId) {
      where.encadrantId = query.encadrantId;
    }

    if (query.anneeId) {
      const annee = await this.prisma.anneeAcademique.findUnique({
        where: { id: query.anneeId },
      });
      if (!annee) throw new BadRequestException('Année académique introuvable');
      const fin = new Date(annee.dateFin);
      fin.setUTCDate(fin.getUTCDate() + 1);
      where.createdAt = { gte: annee.dateDebut, lt: fin };
    }

    return this.findAll(query, where);
  }

  /** Détail d'un travail, avec la même garde de périmètre que la liste. */
  async detail(id: string, user: AuthUser) {
    const travail: any = await this.findOne(id);
    this.autoriserLecture(travail, user);
    return travail;
  }

  // ------------------------------------------------------------------
  // Création & modification
  // ------------------------------------------------------------------

  async creer(dto: CreateTravailDto, user: AuthUser) {
    // `etudiantId` est un champ scalaire du modèle mais pas de
    // TravailEncadreCreateInput (relation) : on passe par `any`, comme la
    // base CrudService qui crée avec les champs bruts.
    let donnees: any = { ...dto };
    if (user.role === Role.ETUDIANT) {
      if (!user.etudiantId) throw new ForbiddenException('Aucune fiche étudiant rattachée');
      if (dto.type && !['STAGE', 'RAPPORT'].includes(dto.type)) {
        throw new ForbiddenException('Un étudiant ne propose que des stages ou des rapports');
      }
      // Il devient l'étudiant du travail ; la proposition part en PROPOSE et
      // sans encadrant : c'est la scolarité qui attribue l'encadrement.
      donnees = {
        ...dto,
        type: dto.type ?? 'RAPPORT',
        etudiantId: user.etudiantId,
        encadrantId: null,
        statut: StatutEncadrement.PROPOSE,
      };
    } else {
      // Statut initial borné à PROPOSE / VALIDE : la suite appartient à la machine.
      if (donnees.statut && !['PROPOSE', 'VALIDE'].includes(donnees.statut)) {
        throw new BadRequestException(
          `Statut initial invalide (${donnees.statut}) : créer en PROPOSE puis faire évoluer`,
        );
      }
    }
    const travail = await this.create(donnees);
    await this.tracer(user, 'TRAVAIL_ENCADRE_CREE', travail.id, travail.intitule);
    return travail;
  }

  /** Modification : la vie du statut passe par /transition, jamais par la PUT. */
  async modifier(id: string, dto: UpdateTravailDto, user: AuthUser) {
    const travail: any = await this.findOne(id);
    this.autoriserPropriete(travail, user);

    if (dto.statut !== undefined && dto.statut !== travail.statut) {
      throw new ForbiddenException(
        "Le statut évolue par la machine à états (POST /transition), pas par modification",
      );
    }

    const { statut: _statut, etudiantId, ...reste } = dto as any;
    const donnees = { ...reste };
    // Un travail ne change pas de porteur par la PUT : l'étudiant est la clé
    // du périmètre (une erreur de saisie passe par la réaffectation en création).
    if (etudiantId !== undefined && etudiantId !== travail.etudiantId) {
      throw new ForbiddenException('Le porteur d’un travail ne se change pas par la PUT');
    }

    return this.update(id, donnees);
  }

  /** Suppression : réservée à l'administration, tant que le dossier n'est pas engagé. */
  async supprimer(id: string) {
    const travail: any = await this.findOne(id);
    if (![StatutEncadrement.PROPOSE, StatutEncadrement.VALIDE].includes(travail.statut)) {
      throw new BadRequestException(
        `Un travail ${travail.statut} ne se supprime pas : abandonnez-le ou laissez-le vivre`,
      );
    }
    await this.remove(id);
    return { id };
  }

  // ------------------------------------------------------------------
  // Machine à états
  // ------------------------------------------------------------------

  async transition(id: string, cible: StatutEncadrement, user: AuthUser) {
    const travail: any = await this.findOne(id);
    this.autoriserPropriete(travail, user);
    if (user.role === Role.ENSEIGNANT && !travail.encadrantId) {
      throw new ForbiddenException('Ce travail n’a pas d’encadrant');
    }

    if ((cible as StatutEncadrement) === travail.statut) {
      // Idempotent : revendiquer le même état n'est pas une erreur, c'est un no-op.
      return travail;
    }
    const autorisees = TRANSITIONS[travail.statut] ?? [];
    if (!autorisees.includes(cible)) {
      throw new BadRequestException(
        `Transition ${travail.statut} → ${cible} interdite (autorisées : ${autorisees.join(', ') || 'aucune'})`,
      );
    }

    if (cible === StatutEncadrement.VALIDE && !travail.encadrantId) {
      throw new BadRequestException(
        'Un encadrant doit être désigné avant la validation (attribuez-le via la modification)',
      );
    }

    if (cible === StatutEncadrement.SOUTENU) {
      if (!travail.rapportRendu) {
        throw new BadRequestException(
          'La soutenance suppose le rapport rendu : cochez « rapport rendu » d’abord',
        );
      }
      if (!travail.soutenance) {
        throw new BadRequestException(
          'Aucune soutenance enregistrée : la défense passe par l’enregistrement d’une soutenance',
        );
      }
    }

    if (cible === StatutEncadrement.PROPOSE && user.role !== Role.ADMIN) {
      throw new ForbiddenException('La réactivation d’un dossier abandonné est réservée à l’administration');
    }

    const maj = await this.prisma.travailEncadre.update({
      where: { id },
      data: { statut: cible },
    });
    await this.tracer(user, `TRAVAIL_${travail.statut}_${cible}`, id, travail.intitule);
    return maj;
  }

  // ------------------------------------------------------------------
  // Soutenances
  // ------------------------------------------------------------------

  /** Enregistrer une soutenance : acte du bureau du jury qui SOUTENU le dossier. */
  async enregistrerSoutenance(dto: CreateSoutenanceDto, user: AuthUser) {
    const travail: any = await this.prisma.travailEncadre.findUnique({
      where: { id: dto.travailEncadreId },
      include: { soutenance: true },
    });
    if (!travail) throw new BadRequestException('Travail introuvable');
    if (travail.statut === StatutEncadrement.SOUTENU || travail.soutenance) {
      throw new BadRequestException('Ce travail est déjà soutenu');
    }
    if (travail.statut === StatutEncadrement.ABANDONNE) {
      throw new BadRequestException('Ce travail est abandonnée : réactivez-le avant de planifier une soutenance');
    }
    if (travail.statut !== StatutEncadrement.EN_COURS) {
      throw new BadRequestException(
        `Un dossier ${travail.statut} ne se soutient pas : il doit être EN_COURS`,
      );
    }
    if (!travail.rapportRendu) {
      throw new BadRequestException(
        'Le rapport doit être rendu avant de planifier la soutenance',
      );
    }

    const soutenance = await this.prisma.soutenance.create({
      data: {
        travailEncadreId: dto.travailEncadreId,
        date: new Date(dto.date),
        salleId: dto.salleId,
        presidentId: dto.presidentId,
        assesseurs: dto.assesseurs,
      },
      include: { salle: true, president: true, travailEncadre: { include: TRAVAIL_INCLUDE } },
    });

    // La soutenance enregistrée EST l'acte de passage en SOUTENU.
    await this.prisma.travailEncadre.update({
      where: { id: travail.id },
      data: { statut: StatutEncadrement.SOUTENU },
    });
    await this.tracer(user, 'SOUTENANCE_CREEE', travail.id, travail.intitule);
    return soutenance;
  }

  /** Constat du jury : note et mention (ADMIN / DIRECTION). */
  async noter(id: string, dto: NoteSoutenanceDto) {
    const soutenance: any = await this.prisma.soutenance.findUnique({
      where: { id },
      include: { travailEncadre: true },
    });
    if (!soutenance) throw new BadRequestException('Soutenance introuvable');
    if (dto.note === undefined && dto.mention === undefined) {
      throw new BadRequestException('Rien à enregistrer : une note ou une mention attendue');
    }
    return this.prisma.soutenance.update({
      where: { id },
      data: { note: dto.note, mention: dto.mention },
      include: { salle: true, president: true, travailEncadre: { include: TRAVAIL_INCLUDE } },
    });
  }

  /** Calendrier des soutenances à venir à 7 jours : j-7 → j+? (registre de la scolarité). */
  async calendrier() {
    const maintenant = new Date();
    const fin = new Date(maintenant.getTime() + 7 * 24 * 60 * 60 * 1000);
    return this.prisma.soutenance.findMany({
      where: { date: { gte: maintenant, lte: fin } },
      orderBy: { date: 'asc' },
      include: {
        salle: true,
        president: true,
        travailEncadre: { include: { etudiant: true, encadrant: true } },
      },
    });
  }

  // ------------------------------------------------------------------
  // Garde partagée
  // ------------------------------------------------------------------

  /** Le travailleur ne touche qu'à son travail ; l'encadrant qu'à ses dossiers. */
  private autoriserPropriete(travail: { etudiantId: string; encadrantId: string | null }, user: AuthUser) {
    if (ROLES_PILOTES.includes(user.role)) return;
    if (user.role === Role.ENSEIGNANT) {
      if (travail.encadrantId !== user.enseignantId) {
        throw new ForbiddenException('Vous n’encadrez pas ce travail');
      }
      return;
    }
    if (user.role === Role.ETUDIANT && travail.etudiantId === user.etudiantId) return;
    throw new ForbiddenException('Ce travail ne vous appartient pas');
  }

  /** Même garde en lecture pour l'état terminal et la fiche détaillée. */
  private autoriserLecture(travail: { etudiantId: string; encadrantId: string | null }, user: AuthUser) {
    if (ROLES_PILOTES.includes(user.role)) return;
    if (user.role === Role.ENSEIGNANT) {
      if (travail.encadrantId !== user.enseignantId) {
        throw new ForbiddenException('Vous n’encadrez pas ce travail');
      }
      return;
    }
    if (user.role === Role.ETUDIANT && travail.etudiantId === user.etudiantId) return;
    throw new ForbiddenException('Ce travail ne vous appartient pas');
  }

  private async tracer(user: AuthUser, action: string, entiteId: string, details?: string) {
    await this.prisma.auditLog.create({
      data: { userId: user.id, action, entite: 'TravailEncadre', entiteId, details },
    });
  }
}