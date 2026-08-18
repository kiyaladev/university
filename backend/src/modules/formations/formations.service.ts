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
import { Paginated } from '../../common/dto';
import { isoDate, toDateOnly } from '../../common/utils';
import { ParametresService } from '../parametres/parametres.module';
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
  paiement: true,
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
  const prefixe = `FOR-${annee}-`;
  const existantes = await tx.inscriptionFormation.findMany({
    where: { numero: { startsWith: prefixe } },
    select: { numero: true },
  });
  const max = existantes.reduce((m, e) => {
    const n = Number(e.numero.slice(prefixe.length));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefixe}${String(max + 1).padStart(5, '0')}`;
}

/** "PAY-F-2026-00001" — paiement Mobile Money d'une formation (PAY-F-AAAA). */
async function prochaineReferencePaiement(
  tx: Prisma.TransactionClient,
  annee: string,
): Promise<string> {
  const prefixe = `PAY-F-${annee}-`;
  const existantes = await tx.paiement.findMany({
    where: { reference: { startsWith: prefixe } },
    select: { reference: true },
  });
  const max = existantes.reduce((m, p) => {
    const n = Number(p.reference.slice(prefixe.length));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefixe}${String(max + 1).padStart(5, '0')}`;
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
    const formation = await this.prisma.formation.findUnique({ where: { id } });
    if (!formation) throw new NotFoundException('Formation introuvable');
    if (formation.statut !== StatutFormation.PUBLIEE) {
      throw new NotFoundException('Formation introuvable');
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
    if (!formation) throw new NotFoundException('Formation introuvable');
    if (formation.statut !== StatutFormation.PUBLIEE) {
      throw new BadRequestException("Cette formation n'est pas ouverte aux inscriptions");
    }

    // Le matricule INE (facultatif) rattache la fiche étudiante existante.
    let etudiantId = dto.etudiantId ?? null;
    if (dto.matricule) {
      const etudiant = await this.prisma.etudiant.findUnique({
        where: { matricule: dto.matricule.trim() },
        select: { id: true },
      });
      if (!etudiant) {
        throw new BadRequestException(
          `Aucun étudiant ne porte le matricule ${dto.matricule} — laissez le champ vide si vous n'êtes pas encore étudiant`,
        );
      }
      etudiantId = etudiant.id;
    }

    const confirmees = await this.prisma.inscriptionFormation.count({
      where: { formationId, statut: StatutInscriptionFormation.CONFIRMEE },
    });
    if (formation.capacite != null && confirmees >= formation.capacite) {
      throw new ConflictException(
        'Formation complète : toutes les places sont réservées. Contactez la scolarité.',
      );
    }

    const annee = String(new Date().getFullYear());
    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const creation = await this.prisma.$transaction(async (tx) => {
          const paiement = await tx.paiement.create({
            data: {
              reference: await prochaineReferencePaiement(tx, annee),
              montant: formation.prix,
              devise: formation.devise,
              mode: 'MOBILE_MONEY',
              telephone: dto.telephone,
              nomComplet: dto.nomComplet,
              motif: `Formation : ${formation.titre}`,
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
              details: `${inscription.numero} — ${dto.nomComplet} · ${formation.titre} (${paiement.reference})`,
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
    throw new ConflictException('Référence de dossier temporairement indisponible, réessayez');
  }

  // -------------------------------------------------------------- gestion

  /**
   * Tableau de bord agrégé pour la page d'administration : chaque formation
   * expose ses compteurs (inscrits, payés, recette encaissée) et les totaux
   * sont cumulés en une seule passe — un groupBy pour les inscrits, un
   * findMany pour les paiements réussis (la relation est nullable, on
   * cumule en mémoire). On évite ainsi le N+1 du front qui itérait sur la
   * liste des formations.
   */
  async dashboard() {
    const [formations, inscritsParFormation, paiementsReussis] = await Promise.all([
      this.prisma.formation.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, titre: true, prix: true, devise: true, statut: true },
      }),
      this.prisma.inscriptionFormation.groupBy({
        by: ['formationId'],
        _count: { _all: true },
      }),
      this.prisma.paiement.findMany({
        where: {
          statut: StatutPaiement.REUSSI,
          inscriptionFormation: { isNot: null },
        },
        select: {
          montant: true,
          inscriptionFormation: { select: { formationId: true } },
        },
      }),
    ]);

    const inscritsMap = new Map(
      inscritsParFormation.map((g) => [g.formationId, g._count._all]),
    );

    const paiementParFormation = new Map<string, { nbPayes: number; recette: number }>();
    for (const p of paiementsReussis) {
      const formationId = p.inscriptionFormation?.formationId;
      if (!formationId) continue;
      const acc = paiementParFormation.get(formationId) ?? { nbPayes: 0, recette: 0 };
      acc.nbPayes += 1;
      acc.recette += p.montant;
      paiementParFormation.set(formationId, acc);
    }

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
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';
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
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.formation.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async trouverFormation(id: string) {
    const formation = await this.prisma.formation.findUnique({
      where: { id },
      include: FORMATION_INCLUDE,
    });
    if (!formation) throw new NotFoundException('Formation introuvable');
    return formation;
  }

  /** Toute formation naît en BROUILLON ; seule la publication l'ouvre au public. */
  async creer(dto: CreateFormationDto, user: AuthUser) {
    const formation = await this.prisma.formation.create({
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
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FORMATION_CREE',
        entite: 'Formation',
        entiteId: formation.id,
        details: `${formation.titre} — ${formation.prix} ${formation.devise} (brouillon)`,
      },
    });
    return formation;
  }

  /**
   * Le titre et le prix se figent dès qu'une inscription confirmée (payée)
   * existe : un diplômé a acheté la formation telle qu'affichée. Le reste
   * (dates, lieu, description…) reste modifiable, sauf formation close.
   */
  async modifier(id: string, dto: UpdateFormationDto, user: AuthUser) {
    const formation = await this.trouverFormation(id);
    if (formation.statut === StatutFormation.COMPLETE) {
      throw new BadRequestException(
        'Formation close : le contenu en est figé, rouvrez-la avant de la modifier',
      );
    }
    const confirmee = await this.prisma.inscriptionFormation.count({
      where: { formationId: id, statut: StatutInscriptionFormation.CONFIRMEE },
    });
    if (confirmee > 0 && (dto.titre !== undefined || dto.prix !== undefined)) {
      throw new ConflictException(
        `${confirmee} inscription(s) déjà confirmée(s) et payée(s) : le titre et le prix de la formation sont figés.`,
      );
    }
    const maj = await this.prisma.formation.update({
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
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FORMATION_MODIFIEE',
        entite: 'Formation',
        entiteId: id,
        details: `${maj.titre} (mise à jour par ${user.prenom} ${user.nom})`,
      },
    });
    return maj;
  }

  /** Seul un brouillon sans inscription s'efface ; les autres se clôturent. */
  async supprimer(id: string, user: AuthUser) {
    const formation = await this.trouverFormation(id);
    if (formation.statut !== StatutFormation.BROUILLON) {
      throw new ForbiddenException(
        'Une formation publiée ou complète ne s’efface pas : clôturez-la pour en arrêter les inscriptions',
      );
    }
    if (formation._count.inscriptions > 0) {
      throw new ConflictException(
        'Des demandes sont déjà déposées sur cette formation : annulez-les avant de la supprimer',
      );
    }
    await this.prisma.formation.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FORMATION_SUPPRIMEE',
        entite: 'Formation',
        entiteId: id,
        details: `${formation.titre} (brouillon supprimé)`,
      },
    });
    return { id };
  }

  /** BROUILLON → PUBLIEE : la vitrine s'ouvre, les demandes affluent. */
  async publier(id: string, user: AuthUser) {
    const formation = await this.trouverFormation(id);
    if (formation.statut !== StatutFormation.BROUILLON) {
      throw new BadRequestException(
        formation.statut === StatutFormation.COMPLETE
          ? 'Formation close : elle ne peut plus être publiée'
          : 'Cette formation est déjà publiée',
      );
    }
    const maj = await this.prisma.formation.update({
      where: { id },
      data: { statut: StatutFormation.PUBLIEE },
      include: FORMATION_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FORMATION_PUBLIEE',
        entite: 'Formation',
        entiteId: id,
        details: `${maj.titre} — publication de la vitrine`,
      },
    });
    return maj;
  }

  /** PUBLIEE → COMPLETE : fin des inscriptions, les dossiers en cours restent. */
  async cloturer(id: string, user: AuthUser) {
    const formation = await this.trouverFormation(id);
    if (formation.statut !== StatutFormation.PUBLIEE) {
      throw new BadRequestException(
        formation.statut === StatutFormation.BROUILLON
          ? "Une formation en brouillon ne se clôt pas : publiez-la d'abord"
          : 'Cette formation est déjà clôturée',
      );
    }
    const maj = await this.prisma.formation.update({
      where: { id },
      data: { statut: StatutFormation.COMPLETE },
      include: FORMATION_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FORMATION_CLOTUREE',
        entite: 'Formation',
        entiteId: id,
        details: `${maj.titre} — le circuit de la promotion est clos`,
      },
    });
    return maj;
  }

  // --------------------------------------------------------- le registre

  async inscriptionsDe(formationId: string) {
    await this.trouverFormation(formationId);
    return this.prisma.inscriptionFormation.findMany({
      where: { formationId },
      include: INSCRIPTION_FORMATION_INCLUDE,
      orderBy: { inscriteLe: 'desc' },
    });
  }

  async trouverInscription(id: string) {
    const inscription = await this.prisma.inscriptionFormation.findUnique({
      where: { id },
      include: INSCRIPTION_FORMATION_INCLUDE,
    });
    if (!inscription) throw new NotFoundException('Inscription à la formation introuvable');
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
    if (inscription.statut === StatutInscriptionFormation.ANNULEE) {
      throw new BadRequestException('Cette demande est annulée : elle ne peut plus être confirmée');
    }
    if (inscription.statut === StatutInscriptionFormation.CONFIRMEE) {
      return inscription;
    }
    if (inscription.formation.statut === StatutFormation.COMPLETE) {
      throw new ConflictException(
        'La formation est close : cette place ne peut plus être confirmée',
      );
    }
    const paiement = inscription.paiement;
    if (!paiement) {
      throw new ConflictException("Aucun paiement n'est lié à cette demande : confirmez impossibilité");
    }

    const maj = await this.prisma.$transaction(async (tx) => {
      await tx.paiement.update({
        where: { id: paiement.id },
        data: { statut: 'REUSSI', completeLe: new Date() },
      });
      return tx.inscriptionFormation.update({
        where: { id },
        data: { statut: StatutInscriptionFormation.CONFIRMEE },
        include: INSCRIPTION_FORMATION_INCLUDE,
      });
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FORMATION_CONFIRMEE',
        entite: 'InscriptionFormation',
        entiteId: id,
        details: `${maj.numero} — ${maj.nomComplet ?? (maj.etudiant ? `${maj.etudiant.prenom} ${maj.etudiant.nom}` : 'anonyme')} · ${maj.formation.titre} (paiement ${maj.paiement?.reference})`,
      },
    });
    return maj;
  }

  /** Annulation (scolarité / direction) : la place est libérée, le paiement reste tracé. */
  async annuler(id: string, user: AuthUser) {
    const inscription = await this.trouverInscription(id);
    if (inscription.statut === StatutInscriptionFormation.ANNULEE) {
      throw new BadRequestException('Cette demande est déjà annulée');
    }
    const maj = await this.prisma.inscriptionFormation.update({
      where: { id },
      data: { statut: StatutInscriptionFormation.ANNULEE },
      include: INSCRIPTION_FORMATION_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FORMATION_INSCRIPTION_ANNULEE',
        entite: 'InscriptionFormation',
        entiteId: id,
        details: `${maj.numero} — ${maj.formation.titre} (annulation par ${user.prenom} ${user.nom})`,
      },
    });
    return maj;
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
      this.jwt.verify(token ?? '', { secret: process.env.JWT_SECRET ?? 'change-me-in-production' });
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }

    const inscription = await this.trouverInscription(id);
    if (inscription.statut !== StatutInscriptionFormation.CONFIRMEE) {
      throw new BadRequestException(
        `${inscription.numero} n'est pas confirmée (${LIBELLE_STATUT_INSCRIPTION[inscription.statut] ?? inscription.statut}) : l'attestation n'est délivrée qu'aux formations suivies et réglées`,
      );
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

    const etablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');
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
    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Attestation de formation — ${echapper(inscription.numero)}</title>
<style>
  ${STYLE_CERTIFICAT}
</style></head>
<body>
  <header>
    <div class="etab">${echapper(etablissement)}</div>
    <div class="titre">Attestation de formation</div>
    <div class="sous-titre">Formation continue & certifications professionnelles</div>
  </header>
  <div class="meta">
    <span>N° dossier : <strong>${echapper(inscription.numero)}</strong></span>
    <span>Édité le ${edite}</span>
  </div>
  <table>
    <tbody>
      <tr><th>Diplômé(e)</th><td>${echapper(diplome)}${inscription.etudiant?.matricule ? ` <small>(${echapper(inscription.etudiant.matricule)})</small>` : ''}</td></tr>
      <tr><th>Formation suivie</th><td>${echapper(formation.titre)}${formation.categorie ? ` — ${echapper(formation.categorie)}` : ''}</td></tr>
      <tr><th>Période</th><td>${dates ? echapper(dates) : '—'}</td></tr>
      <tr><th>Durée totale</th><td>${formation.dureeHeures ? `${formation.dureeHeures} h` : '—'}${formation.lieu ? ` · ${echapper(formation.lieu)}` : ''}</td></tr>
    </tbody>
  </table>
  <div class="mention">
    La présente attestation certifie que la personne ci-dessus a été inscrite,
    a réglé les frais de la formation (${formation.prix.toLocaleString('fr-FR')} ${echapper(formation.devise)}) et a suivi
    l'intégralité du programme. La scolarité de l'université en établit le
    bilan définitif et remet, le cas échéant, le document officiel du parcours.
  </div>
  <div class="verification">
    ${svg}
    <div class="mention">QR — page publique de la formation (${echapper(urlPublique)})</div>
    <div class="numero-clair">N° ${echapper(inscription.numero)}</div>
  </div>
  <div class="signatures">
    <div class="signature">Le responsable de la formation</div>
    <div class="signature">La direction des affaires financières</div>
  </div>
  <footer>
    <span>${echapper(etablissement)} — hub de formation continue</span>
    <span>Vérifiable via le service attestations de l'université · Édité le ${edite}</span>
  </footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }
}

/** Échappement HTML strict (copie de la convention des états imprimés). */
function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Le style d'impression est la copie locale de celui des états imprimés
 * (modules/rapports — fichier intouchable) : en-tête d'établissement, filets,
 * signatures de pied de page. Quiconque modifie la charte des états doit
 * reporter les changements ici.
 */
const STYLE_CERTIFICAT = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm 12mm; font-size: 12px; }
  header { border-bottom: 2px solid #1565c0; padding-bottom: 8px; margin-bottom: 14px; }
  .etab { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .titre { font-size: 19px; font-weight: 700; margin-top: 6px; color: #0d47a1; }
  .sous-titre { color: #555; margin-top: 2px; }
  .meta { display: flex; gap: 18px; margin: 12px 0 4px; font-size: 11px; color: #444; flex-wrap: wrap; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #b9c4cf; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #e8eef5; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; width: 30%; }
  .mention { margin-top: 14px; padding: 8px 10px; border: 1px solid #b9c4cf; background: #fafbfd; font-size: 11px; color: #444; }
  .verification { margin-top: 22px; border-top: 1px solid #b9c4cf; padding-top: 12px; text-align: center; }
  .verification svg { width: 200px; height: 200px; }
  .verification .mention { font-size: 10px; color: #777; margin-top: 6px; word-break: break-all; border: none; background: none; padding: 0; }
  .verification .numero-clair { font-size: 12px; font-weight: 700; letter-spacing: .4px; margin-top: 4px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 44px; }
  .signature { width: 38%; border-top: 1px solid #999; padding-top: 4px; text-align: center; color: #555; }
  footer { margin-top: 22px; font-size: 10px; color: #777; display: flex; justify-content: space-between; border-top: 1px solid #e3e8ee; padding-top: 6px; }
  @media print { body { padding: 8mm; } .no-print { display: none; } }
  @page { size: A4; margin: 10mm; }
`;