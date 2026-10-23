/**
 * Hub de formation continue & certifications — recettes propres de l'université.
 *
 * Une formation PUBLIEE se vend en ligne, sans compte : n'importe qui dépose
 * sa demande (identité + téléphone Mobile Money), un paiement PAY-F-AAAA naît
 * en EN_ATTENTE (écriture Prisma directe — le pipeline /api/paiements exige un
 * compte connecté, la vitrine publique n'en a pas), et l'équipe de la
 * scolarité / de la direction confirme l'encaissement en mode pilote
 * (POST /formations/inscriptions/:id/confirmer) : le paiement passe REUSSI
 * puis l'inscription passe CONFIRMEE. Au bout du circuit, la scolarité remet
 * l'attestation (module attestations — la vérification par QR s'y fait ; ici
 * le certificat A4 ne fait que signaler l'existence du service).
 *
 * Le nombre de places se lit sur les inscriptions CONFIRMEE : annuler une
 * demande libère la place, confirmer après COMPLETE est refusé.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, StatutFormation, StatutInscriptionFormation, StatutPaiement } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated, QueryDto } from '../../common/dto';
import { isoDate, toDateOnly } from '../../common/utils';
import { chargerEtablissement, echapper, pageA4, PALETTE_IMPRESSION as P } from '../../common/impression';
import { ParametresService } from '../parametres/parametres.service';
import { anneeNumero, prochainNumeroTx } from '../../common/numero';
import { creerPaiementTx } from '../../common/finances';
import { t } from '../../common/i18n';
import {
  CreateFormationDto,
  FormationQueryDto,
  InscriptionFormationPubliqueDto,
  UpdateFormationDto,
} from './formations.dto';

export const FORMATION_INCLUDE = {
  creePar: { select: { id: true, nom: true, prenom: true } },
  _count: { select: { inscriptions: true } },
} satisfies Prisma.FormationInclude;

/** Champs autorisés dans la vitrine publique (sans métadonnées internes). */
export const FORMATION_PUBLIQUE_SELECT = {
  id: true,
  titre: true,
  description: true,
  categorie: true,
  prix: true,
  devise: true,
  dureeHeures: true,
  dateDebut: true,
  dateFin: true,
  lieu: true,
  capacite: true,
  statut: true,
} satisfies Prisma.FormationSelect;

export const INSCRIPTION_FORMATION_INCLUDE = {
  formation: {
    select: {
      id: true,
      titre: true,
      description: true,
      categorie: true,
      prix: true,
      devise: true,
      dureeHeures: true,
      dateDebut: true,
      dateFin: true,
      lieu: true,
      capacite: true,
      statut: true,
    },
  },
  etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
  paiement: { select: { id: true, reference: true, montant: true, devise: true, statut: true } },
} satisfies Prisma.InscriptionFormationInclude;

const LIBELLE_STATUT_INSCRIPTION: Record<string, string> = {
  EN_ATTENTE: 'En attente de paiement',
  CONFIRMEE: 'Confirmée',
  ANNULEE: 'Annulée',
};

/** "FOR-2026-00001" — dossier d'inscription à une formation continue. */
async function prochainNumeroFormation(
  tx: Prisma.TransactionClient,
  annee: string,
): Promise<string> {
  return prochainNumeroTx(tx, 'inscriptionFormation', 'numero', `FOR-${annee}-`, 5);
}

/** "PAY-F-2026-00001" — paiement Mobile Money d'une formation (PAY-F-AAAA). */
async function prochaineReferencePaiement(
  tx: Prisma.TransactionClient,
  annee: string,
): Promise<string> {
  return prochainNumeroTx(tx, 'paiement', 'reference', `PAY-F-${annee}-`, 5);
}

@Injectable()
export class FormationsService {
  constructor(
    private prisma: PrismaService,
    private parametres: ParametresService,
    private jwt: JwtService,
  ) {}

  // ------------------------------------------------------- vitrine publique

  /**
   * Les formations PUBLIEE, dans l'ordre de démarrage, avec le nombre de
   * places restantes (capacité moins les inscriptions CONFIRMEE). Sans
   * capacité, la place n'est pas limitée.
   */
  async formationsPubliques() {
    const [formations, comptes] = await Promise.all([
      this.prisma.formation.findMany({
        where: { statut: StatutFormation.PUBLIEE },
        orderBy: [{ dateDebut: 'asc' }],
        take: 100,
        select: FORMATION_PUBLIQUE_SELECT,
      }),
      this.prisma.inscriptionFormation.groupBy({
        by: ['formationId'],
        where: { statut: StatutInscriptionFormation.CONFIRMEE },
        _count: { _all: true },
      }),
    ]);
    const confirmees = new Map(comptes.map((c) => [c.formationId, c._count._all]));
    return formations.map((f) => ({
      ...f,
      inscrits: confirmees.get(f.id) ?? 0,
      placesRestantes:
        f.capacite == null ? null : Math.max(0, f.capacite - (confirmees.get(f.id) ?? 0)),
    }));
  }

  /** Détail public d'une formation : introuvable si elle n'est pas publiée. */
  async formationPublique(id: string) {
    const formation = await this.prisma.formation.findUnique({
      where: { id },
      select: FORMATION_PUBLIQUE_SELECT,
    });
    if (!formation) throw new NotFoundException(t('formations.formation_introuvable'));
    if (formation.statut !== StatutFormation.PUBLIEE) {
      throw new NotFoundException(t('formations.formation_introuvable'));
    }
    const confirmees = await this.prisma.inscriptionFormation.count({
      where: { formationId: id, statut: StatutInscriptionFormation.CONFIRMEE },
    });
    return {
      ...formation,
      inscrits: confirmees,
      placesRestantes:
        formation.capacite == null ? null : Math.max(0, formation.capacite - confirmees),
    };
  }

  // -------------------------------------------------- inscription publique

  /**
   * Demande payante sans compte : crée l'inscription EN_ATTENTE (numéro
   * FOR-AAAA-NNNNN) et le paiement Mobile Money EN_ATTENTE (référence
   * PAY-F-AAAA, motif « Formation : <titre> »), puis relie le paiement.
   * La confirmation de l'opérateur est simulée au guichet par un agent
   * (POST /formations/inscriptions/:id/confirmer) — mode pilote.
   */
  async inscriptionPublique(
    formationId: string,
    dto: InscriptionFormationPubliqueDto,
    ip?: string,
  ) {
    const formation = await this.prisma.formation.findUnique({ where: { id: formationId } });
    if (!formation) throw new NotFoundException(t('formations.formation_introuvable'));
    if (formation.statut !== StatutFormation.PUBLIEE) {
      throw new BadRequestException(t('formations.cette_formation_n_est_pas_ouverte_aux_inscriptions'));
    }

    // Le matricule INE (facultatif) rattache la fiche étudiante existante.
    let etudiantId = dto.etudiantId ?? null;
    if (dto.matricule) {
      const etudiant = await this.prisma.etudiant.findUnique({
        where: { matricule: dto.matricule.trim() },
        select: { id: true },
      });
      if (!etudiant) {
        throw new BadRequestException(t('formations.aucun_etudiant_ne_porte_le_matricule_dto_matricule_laissez_l', { matricule: dto.matricule }));
      }
      etudiantId = etudiant.id;
    }

    const confirmees = await this.prisma.inscriptionFormation.count({
      where: { formationId, statut: StatutInscriptionFormation.CONFIRMEE },
    });
    if (formation.capacite != null && confirmees >= formation.capacite) {
      throw new ConflictException(t('formations.formation_complete_toutes_les_places_sont_reservees_contacte'));
    }

    const annee = anneeNumero();
    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const creation = await this.prisma.$transaction(async (tx) => {
          const verrou = await this.verrouillerFormation(tx, formationId);
          const formationCourante = await tx.formation.findUnique({ where: { id: formationId } });
          if (!formationCourante || formationCourante.statut !== StatutFormation.PUBLIEE) {
            throw new BadRequestException(t('formations.cette_formation_n_est_pas_ouverte_aux_inscriptions'));
          }
          const confirmees = await tx.inscriptionFormation.count({
            where: { formationId, statut: StatutInscriptionFormation.CONFIRMEE },
          });
          if (verrou.capacite != null && confirmees >= verrou.capacite) {
            throw new ConflictException(t('formations.formation_complete_toutes_les_places_sont_reservees_contacte'));
          }
          const paiement = await creerPaiementTx(tx, {
            data: {
              reference: await prochaineReferencePaiement(tx, annee),
              montant: formationCourante.prix,
              devise: formationCourante.devise,
              mode: 'MOBILE_MONEY',
              telephone: dto.telephone,
              nomComplet: dto.nomComplet,
              motif: `Formation : ${formationCourante.titre}`,
              statut: 'EN_ATTENTE',
              etudiantId,
            },
            select: { id: true, reference: true, montant: true, devise: true },
          });
          const inscription = await tx.inscriptionFormation.create({
            data: {
              numero: await prochainNumeroFormation(tx, annee),
              formationId,
              etudiantId,
              nomComplet: dto.nomComplet,
              telephone: dto.telephone,
              email: dto.email ?? null,
              statut: StatutInscriptionFormation.EN_ATTENTE,
              paiementId: paiement.id,
            },
            select: { id: true, numero: true, statut: true },
          });
          await tx.auditLog.create({
            data: {
              action: 'FORMATION_INSCRIPTION',
              entite: 'InscriptionFormation',
              entiteId: inscription.id,
              details: JSON.stringify({
                avant: null,
                apres: { statut: inscription.statut, formationId, paiementId: paiement.id },
              }),
              ip: ip ?? null,
            },
          });
          return { inscription, paiement };
        });

        return {
          inscriptionId: creation.inscription.id,
          numero: creation.inscription.numero,
          montant: creation.paiement.montant,
          devise: creation.paiement.devise,
          message:
            `Demande ${creation.inscription.numero} déposée. Réglez ` +
            `${creation.paiement.montant.toLocaleString('fr-FR')} ${creation.paiement.devise} ` +
            `par Mobile Money ; la confirmation se fait au guichet de la scolarité.`,
        };
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(t('formations.reference_de_dossier_temporairement_indisponible_reessayez'));
  }

  // -------------------------------------------------------------- gestion

  /**
   * Tableau de bord agrégé pour la page d'administration : chaque formation
   * expose ses compteurs (inscrits, payés, recette encaissée) et les totaux
   * sont cumulés côté base : un groupBy pour les inscrits et un agrégat SQL
   * groupé par formation pour les paiements réussis. On évite le chargement
   * intégral du registre des paiements et le N+1 du front.
   */
  async dashboard() {
    const [formations, inscritsParFormation, paiementsParFormation] = await Promise.all([
      this.prisma.formation.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, titre: true, prix: true, devise: true, statut: true },
      }),
      this.prisma.inscriptionFormation.groupBy({
        by: ['formationId'],
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ formationId: string; nbPayes: bigint; recette: number }>>(Prisma.sql`
        SELECT inscription."formationId" AS "formationId",
               COUNT(*)::bigint AS "nbPayes",
               COALESCE(SUM(paiement."montant"), 0)::double precision AS "recette"
        FROM "Paiement" AS paiement
        INNER JOIN "InscriptionFormation" AS inscription
          ON inscription."paiementId" = paiement."id"
        WHERE paiement."statut" = ${StatutPaiement.REUSSI}::"StatutPaiement"
        GROUP BY inscription."formationId"
      `),
    ]);

    const inscritsMap = new Map(
      inscritsParFormation.map((g) => [g.formationId, g._count._all]),
    );

    const paiementParFormation = new Map(
      paiementsParFormation.map((p) => [p.formationId, { nbPayes: Number(p.nbPayes), recette: Number(p.recette) }]),
    );

    const parFormation = formations.map((f) => {
      const paiement = paiementParFormation.get(f.id) ?? { nbPayes: 0, recette: 0 };
      return {
        id: f.id,
        intitule: f.titre,
        statut: f.statut,
        prix: f.prix,
        devise: f.devise,
        nbInscrits: inscritsMap.get(f.id) ?? 0,
        nbPayes: paiement.nbPayes,
        recette: paiement.recette,
      };
    });

    const totaux = parFormation.reduce(
      (acc, f) => ({
        inscrits: acc.inscrits + f.nbInscrits,
        payes: acc.payes + f.nbPayes,
        recette: acc.recette + f.recette,
      }),
      { inscrits: 0, payes: 0, recette: 0 },
    );

    return {
      total: parFormation.length,
      parFormation,
      totaux,
    };
  }

  async liste(query: FormationQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const all = query.all === 'true' || query.all === '1';
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (all ? 1000 : 50))));
    const where: Prisma.FormationWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.search
        ? {
            OR: [
              { titre: { contains: query.search, mode: 'insensitive' } },
              { categorie: { contains: query.search, mode: 'insensitive' } },
              { lieu: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.formation.findMany({
        where,
        include: FORMATION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...(all ? { skip: 0, take: pageSize } : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.formation.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  async trouverFormation(id: string) {
    const formation = await this.prisma.formation.findUnique({
      where: { id },
      include: FORMATION_INCLUDE,
    });
    if (!formation) throw new NotFoundException(t('formations.formation_introuvable'));
    return formation;
  }

  /** Toute formation naît en BROUILLON ; seule la publication l'ouvre au public. */
  async creer(dto: CreateFormationDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const formation = await tx.formation.create({
        data: {
          titre: dto.titre,
          description: dto.description ?? null,
          categorie: dto.categorie ?? null,
          prix: dto.prix ?? 0,
          devise: dto.devise ?? 'GNF',
          dureeHeures: dto.dureeHeures ?? null,
          dateDebut: dto.dateDebut ? toDateOnly(dto.dateDebut) : null,
          dateFin: dto.dateFin ? toDateOnly(dto.dateFin) : null,
          lieu: dto.lieu ?? null,
          capacite: dto.capacite ?? null,
          statut: StatutFormation.BROUILLON,
          creeParId: user.id,
        },
        include: FORMATION_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'FORMATION_CREE',
          entite: 'Formation',
          entiteId: formation.id,
          details: JSON.stringify({ avant: null, apres: this.instantaneAudit(formation) }),
        },
      });
      return formation;
    });
  }

  /**
   * Le titre et le prix se figent dès qu'une inscription confirmée (payée)
   * existe : un diplômé a acheté la formation telle qu'affichée. Le reste
   * (dates, lieu, description…) reste modifiable, sauf formation close.
   */
  async modifier(id: string, dto: UpdateFormationDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.verrouillerFormation(tx, id);
      const formation = await tx.formation.findUnique({ where: { id }, include: FORMATION_INCLUDE });
      if (!formation) throw new NotFoundException(t('formations.formation_introuvable'));
      if (formation.statut === StatutFormation.COMPLETE) {
        throw new BadRequestException(t('formations.formation_close_le_contenu_en_est_fige_rouvrez_la_avant_de_l'));
      }
      const confirmee = await tx.inscriptionFormation.count({
        where: { formationId: id, statut: StatutInscriptionFormation.CONFIRMEE },
      });
      if (confirmee > 0 && (dto.titre !== undefined || dto.prix !== undefined)) {
        throw new ConflictException(t('formations.confirmee_inscription_s_deja_confirmee_s_et_payee_s_le_titre', { confirmee }));
      }
      if (dto.capacite !== undefined && dto.capacite !== null && dto.capacite < confirmee) {
        throw new ConflictException(t('formations.capacite_inferieure_aux_inscriptions_confirmees'));
      }
      if (dto.capacite === null && confirmee > 0) {
        throw new ConflictException(t('formations.capacite_inferieure_aux_inscriptions_confirmees'));
      }
      const maj = await tx.formation.update({
        where: { id },
        data: {
          ...(dto.titre !== undefined ? { titre: dto.titre } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.categorie !== undefined ? { categorie: dto.categorie } : {}),
          ...(dto.prix !== undefined ? { prix: dto.prix } : {}),
          ...(dto.devise !== undefined ? { devise: dto.devise } : {}),
          ...(dto.dureeHeures !== undefined ? { dureeHeures: dto.dureeHeures } : {}),
          ...(dto.dateDebut !== undefined ? { dateDebut: toDateOnly(dto.dateDebut) } : {}),
          ...(dto.dateFin !== undefined ? { dateFin: toDateOnly(dto.dateFin) } : {}),
          ...(dto.lieu !== undefined ? { lieu: dto.lieu } : {}),
          ...(dto.capacite !== undefined ? { capacite: dto.capacite } : {}),
        },
        include: FORMATION_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'FORMATION_MODIFIEE',
          entite: 'Formation',
          entiteId: id,
          details: JSON.stringify({
            avant: this.instantaneAudit(formation),
            apres: this.instantaneAudit(maj),
          }),
        },
      });
      return maj;
    });
  }

  /** Seul un brouillon sans inscription s'efface ; les autres se clôturent. */
  async supprimer(id: string, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      await this.verrouillerFormation(tx, id);
      const formation = await tx.formation.findUnique({ where: { id }, include: FORMATION_INCLUDE });
      if (!formation) throw new NotFoundException(t('formations.formation_introuvable'));
      if (formation.statut !== StatutFormation.BROUILLON) {
        throw new ForbiddenException(t('formations.une_formation_publiee_ou_complete_ne_s_efface_pas_cloturez_l'));
      }
      if (formation._count.inscriptions > 0) {
        throw new ConflictException(t('formations.des_demandes_sont_deja_deposees_sur_cette_formation_annulez_'));
      }
      await tx.formation.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'FORMATION_SUPPRIMEE',
          entite: 'Formation',
          entiteId: id,
          details: JSON.stringify({ avant: this.instantaneAudit(formation), apres: null }),
        },
      });
    });
    return { id };
  }

  /** BROUILLON → PUBLIEE : la vitrine s'ouvre, les demandes affluent. */
  async publier(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.verrouillerFormation(tx, id);
      const formation = await tx.formation.findUnique({ where: { id } });
      if (!formation) throw new NotFoundException(t('formations.formation_introuvable'));
      if (formation.statut !== StatutFormation.BROUILLON) {
        throw new BadRequestException(
          t(formation.statut === StatutFormation.COMPLETE
            ? 'formations.formation_close_elle_ne_peut_plus_etre_publiee'
            : 'formations.cette_formation_est_deja_publiee'),
        );
      }
      const maj = await tx.formation.update({
        where: { id },
        data: { statut: StatutFormation.PUBLIEE },
        include: FORMATION_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'FORMATION_PUBLIEE',
          entite: 'Formation',
          entiteId: id,
          details: JSON.stringify({
            avant: this.instantaneAudit(formation),
            apres: this.instantaneAudit(maj),
          }),
        },
      });
      return maj;
    });
  }

  /** PUBLIEE → COMPLETE : fin des inscriptions, les dossiers en cours restent. */
  async cloturer(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.verrouillerFormation(tx, id);
      const formation = await tx.formation.findUnique({ where: { id } });
      if (!formation) throw new NotFoundException(t('formations.formation_introuvable'));
      if (formation.statut !== StatutFormation.PUBLIEE) {
        throw new BadRequestException(
          t(formation.statut === StatutFormation.BROUILLON
            ? 'formations.une_formation_en_brouillon_ne_se_clot_pas_publiez_la_d_ab'
            : 'formations.cette_formation_est_deja_cloturee'),
        );
      }
      const maj = await tx.formation.update({
        where: { id },
        data: { statut: StatutFormation.COMPLETE },
        include: FORMATION_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'FORMATION_CLOTUREE',
          entite: 'Formation',
          entiteId: id,
          details: JSON.stringify({
            avant: this.instantaneAudit(formation),
            apres: this.instantaneAudit(maj),
          }),
        },
      });
      return maj;
    });
  }

  private instantaneAudit(formation: any) {
    return {
      id: formation.id,
      titreFourni: Boolean(formation.titre),
      prix: formation.prix,
      devise: formation.devise,
      statut: formation.statut,
      dateDebut: formation.dateDebut ?? null,
      dateFin: formation.dateFin ?? null,
      capacite: formation.capacite ?? null,
    };
  }

  // --------------------------------------------------------- le registre

  async inscriptionsDe(formationId: string, query: QueryDto = {}): Promise<Paginated<any>> {
    await this.trouverFormation(formationId);
    const page = Math.max(1, Number(query.page ?? 1));
    const all = query.all === 'true' || query.all === '1';
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (all ? 1000 : 50))));
    const where = { formationId };
    const [data, total] = await Promise.all([
      this.prisma.inscriptionFormation.findMany({
        where,
        include: INSCRIPTION_FORMATION_INCLUDE,
        orderBy: { inscriteLe: 'desc' },
        skip: all ? 0 : (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inscriptionFormation.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  async trouverInscription(id: string) {
    const inscription = await this.prisma.inscriptionFormation.findUnique({
      where: { id },
      include: INSCRIPTION_FORMATION_INCLUDE,
    });
    if (!inscription) throw new NotFoundException(t('formations.inscription_a_la_formation_introuvable'));
    return inscription;
  }

  /**
   * Confirmation pilote (la scolarité répercute la réponse de l'opérateur
   * Mobile Money au guichet) : le PAIEMENT passe REUSSI (statut, completeLe),
   * puis l'inscription passe CONFIRMEE puisque le paiement est réussi.
   * Refusée si la formation est déjà complète : la place a été prise ailleurs.
   */
  async confirmer(id: string, user: AuthUser) {
    const inscription = await this.trouverInscription(id);
    return this.prisma.$transaction(async (tx) => {
      const formation = await this.verrouillerFormation(tx, inscription.formationId);
      const avant = await tx.inscriptionFormation.findUnique({
        where: { id },
        include: INSCRIPTION_FORMATION_INCLUDE,
      });
      if (!avant) throw new NotFoundException(t('formations.inscription_a_la_formation_introuvable'));
      if (avant.statut === StatutInscriptionFormation.ANNULEE) {
        throw new BadRequestException(t('formations.cette_demande_est_annulee_elle_ne_peut_plus_etre_confirmee'));
      }
      if (avant.statut === StatutInscriptionFormation.CONFIRMEE) return avant;
      if (formation.statut === StatutFormation.COMPLETE) {
        throw new ConflictException(t('formations.la_formation_est_close_cette_place_ne_peut_plus_etre_confirm'));
      }
      const confirmees = await tx.inscriptionFormation.count({
        where: { formationId: formation.id, statut: StatutInscriptionFormation.CONFIRMEE },
      });
      if (formation.capacite != null && confirmees >= formation.capacite) {
        throw new ConflictException(t('formations.la_formation_est_close_cette_place_ne_peut_plus_etre_confirm'));
      }
      const paiement = avant.paiement;
      if (!paiement) {
        throw new ConflictException(t('formations.aucun_paiement_n_est_lie_a_cette_demande_confirmez_impossibi'));
      }
      const paiementMaj = await tx.paiement.updateMany({
        where: { id: paiement.id, statut: StatutPaiement.EN_ATTENTE },
        data: { statut: StatutPaiement.REUSSI, completeLe: new Date() },
      });
      if (paiementMaj.count !== 1) {
        throw new ConflictException(t('formations.aucun_paiement_n_est_lie_a_cette_demande_confirmez_impossibi'));
      }
      const inscriptionMaj = await tx.inscriptionFormation.updateMany({
        where: { id, statut: avant.statut },
        data: { statut: StatutInscriptionFormation.CONFIRMEE },
      });
      if (inscriptionMaj.count !== 1) {
        throw new ConflictException(t('formations.cette_demande_est_annulee_elle_ne_peut_plus_etre_confirmee'));
      }
      const maj = await tx.inscriptionFormation.findUnique({ where: { id }, include: INSCRIPTION_FORMATION_INCLUDE });
      if (!maj) throw new NotFoundException(t('formations.inscription_a_la_formation_introuvable'));
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'FORMATION_CONFIRMEE',
          entite: 'InscriptionFormation',
          entiteId: id,
          details: JSON.stringify({
            avant: { statut: avant.statut, paiement: paiement.statut, formationId: avant.formationId },
            apres: { statut: maj.statut, paiement: maj.paiement?.statut, formationId: maj.formationId },
          }),
        },
      });
      return maj;
    });
  }

  /** Sérialise les confirmations d'une même formation pendant le contrôle de capacité. */
  private async verrouillerFormation(tx: Prisma.TransactionClient, id: string) {
    const formation = typeof (tx as any).$queryRaw === 'function'
      ? ((await (tx as any).$queryRaw`
          SELECT "id", "statut", "capacite"
          FROM "Formation" WHERE "id" = ${id} FOR UPDATE
        `)[0] as { id: string; statut: StatutFormation; capacite: number | null } | undefined)
      : await tx.formation.findUnique({ where: { id }, select: { id: true, statut: true, capacite: true } });
    if (!formation) throw new NotFoundException(t('formations.formation_introuvable'));
    return formation;
  }

  /** Annulation (scolarité / direction) : la place est libérée, le paiement reste tracé. */
  async annuler(id: string, user: AuthUser) {
    const inscription = await this.trouverInscription(id);
    return this.prisma.$transaction(async (tx) => {
      await this.verrouillerFormation(tx, inscription.formationId);
      const avant = await tx.inscriptionFormation.findUnique({ where: { id }, include: INSCRIPTION_FORMATION_INCLUDE });
      if (!avant) throw new NotFoundException(t('formations.inscription_a_la_formation_introuvable'));
      if (avant.statut === StatutInscriptionFormation.ANNULEE) {
        throw new ConflictException(t('formations.cette_demande_est_deja_annulee'));
      }
      if (avant.statut === StatutInscriptionFormation.CONFIRMEE) {
        throw new ConflictException(t('formations.annulation_inscription_confirmee_exige_remboursement'));
      }
      const transition = await tx.inscriptionFormation.updateMany({
        where: { id, statut: avant.statut },
        data: { statut: StatutInscriptionFormation.ANNULEE },
      });
      if (transition.count !== 1) throw new ConflictException(t('formations.cette_demande_est_deja_annulee'));
      const maj = await tx.inscriptionFormation.findUnique({ where: { id }, include: INSCRIPTION_FORMATION_INCLUDE });
      if (!maj) throw new NotFoundException(t('formations.inscription_a_la_formation_introuvable'));
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'FORMATION_INSCRIPTION_ANNULEE',
          entite: 'InscriptionFormation',
          entiteId: id,
          details: JSON.stringify({
            avant: { statut: avant.statut, formationId: avant.formationId },
            apres: { statut: maj.statut, formationId: maj.formationId },
          }),
        },
      });
      return maj;
    });
  }

  // ------------------------------------------------------ certificat A4

  /**
   * Attestation de formation, A4, imprimée en nouvel onglet. Le jeton passe
   * en paramètre d'URL (pas d'en-tête Authorization possible) et est vérifié
   * à la main, comme /attestations/:id/imprimer. Seules les inscriptions
   * CONFIRMEE (payées) donnent droit au document. La vérification du
   * document relève du module attestations : le pied de page le signale.
   */
  async certificat(id: string, token: string | undefined, baseUrl: string): Promise<string> {
    try {
      this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException(t('formations.jeton_invalide_ou_expire'));
    }

    const inscription = await this.trouverInscription(id);
    if (inscription.statut !== StatutInscriptionFormation.CONFIRMEE) {
      throw new BadRequestException(
        t('formations.inscription_numero_n_est_pas_confirmee_libelle_statut_inscri', { numero: inscription.numero, statut: LIBELLE_STATUT_INSCRIPTION[inscription.statut] ?? inscription.statut }),
      );
    }
    if (inscription.paiement?.statut !== StatutPaiement.REUSSI) {
      throw new ConflictException(t('formations.aucun_paiement_n_est_lie_a_cette_demande_confirmez_impossibi'));
    }

    // URL publique portée par le QR : la page vitrine des formations,
    // point de départ du circuit de vérification (module attestations).
    const urlPublique = `${baseUrl.replace(/\/+$/, '')}/#/formations`;
    const svg = await QRCode.toString(urlPublique, {
      type: 'svg',
      margin: 2,
      width: 220,
      errorCorrectionLevel: 'M',
    });

    const etablissement = await chargerEtablissement(this.prisma);
    const formation = inscription.formation;
    const diplome =
      inscription.nomComplet ??
      (inscription.etudiant
        ? `${inscription.etudiant.prenom} ${inscription.etudiant.nom}`
        : null) ??
      '—';
    const edite = new Date().toLocaleString('fr-FR');
    const dates = [
      formation.dateDebut ? isoDate(formation.dateDebut) : null,
      formation.dateFin ? isoDate(formation.dateFin) : null,
    ]
      .filter(Boolean)
      .join(' au ');
    return pageA4({
      titre: `Confirmation d'inscription à une formation — ${inscription.numero}`,
      lang: 'fr',
      etablissement,
      styles: STYLE_CERTIFICAT,
      entete: `<div class="etab">${echapper(etablissement.nom)}</div>
    <div class="titre">Confirmation d'inscription à une formation</div>
    <div class="sous-titre">Formation continue & certifications professionnelles</div>`,
      corps: `<div class="meta">
    <span>N° dossier : <strong>${echapper(inscription.numero)}</strong></span>
    <span>Édité le ${edite}</span>
  </div>
  <table>
    <tbody>
      <tr><th>Participant(e)</th><td>${echapper(diplome)}${inscription.etudiant?.matricule ? ` <small>(${echapper(inscription.etudiant.matricule)})</small>` : ''}</td></tr>
      <tr><th>Formation</th><td>${echapper(formation.titre)}${formation.categorie ? ` — ${echapper(formation.categorie)}` : ''}</td></tr>
      <tr><th>Période</th><td>${dates ? echapper(dates) : '—'}</td></tr>
      <tr><th>Durée totale</th><td>${formation.dureeHeures ? `${formation.dureeHeures} h` : '—'}${formation.lieu ? ` · ${echapper(formation.lieu)}` : ''}</td></tr>
    </tbody>
  </table>
  <div class="mention">
    Le présent document confirme l'inscription de la personne ci-dessus et
    le règlement de ${inscription.paiement.montant.toLocaleString('fr-FR')} ${echapper(inscription.paiement.devise)}.
    La validation pédagogique relève du bilan définitif établi par la scolarité,
    qui remet le document officiel du parcours après contrôle de son achèvement.
  </div>
  <div class="verification">
    ${svg}
    <div class="mention">QR — page publique de la formation (${echapper(urlPublique)})</div>
    <div class="numero-clair">N° ${echapper(inscription.numero)}</div>
  </div>
  <div class="signatures">
    <div class="signature">Le responsable de la formation</div>
    <div class="signature">La direction des affaires financières</div>
  </div>`,
      piedDePage: `<span>${echapper(etablissement.nom)} — hub de formation continue</span>
    <span>Confirmation d'inscription · Édité le ${edite}</span>`,
    });
  }
}

/** Règles propres à la confirmation d'inscription ; le reste vient de `pageA4`. */
const STYLE_CERTIFICAT = `
  th { width: 30%; }
  .mention { margin-top: 14px; padding: 8px 10px; border: 1px solid ${P.grisFilet}; background: ${P.grisFond}; font-size: 11px; color: ${P.encreDouce}; }
  .verification svg { width: 200px; height: 200px; }
  .verification .mention { border: none; background: none; padding: 0; }
  .signatures { margin-top: 44px; }
  .signature { width: 38%; }
`;
