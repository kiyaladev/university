/**
 * Plateforme de demande de documents : l'étudiant formule une demande en
 * ligne, paie les frais au tarif paramétré, la scolarité traite, marque le
 * document comme prêt et le remet. Le document final est livré au guichet.
 *
 * Cycle de vie :
 *  - EN_ATTENTE_PAIEMENT : déclaration, paiement à venir
 *  - PAYEE : paiement réussi, en attente de prise en charge
 *  - EN_TRAITEMENT : la scolarité a pris le dossier
 *  - PRETE : document prêt au retrait (notification SMS à l'étudiant)
 *  - REMISE : document remis au guichet
 *  - REJETEE : demande rejetée (motif obligatoire)
 *
 * Les tarifs par type (TarifDemande) sont paramétrables par l'administrateur.
 * En mode pilote, le paiement Mobile Money est simulé — l'agent comptable
 * confirme via POST /:id/confirmer-paiement.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StatutDemande,
  StatutNotification,
  StatutPaiement,
  TypeDemandeDocument,
  ModePaiement,
} from '@prisma/client';
import { CrudService } from '../../common/crud.service';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';

const PREFIX_DEMANDE = 'DOC-';

const STATUTS_PAIEMENT_REQUIS: StatutDemande[] = [
  StatutDemande.PAYEE,
  StatutDemande.EN_TRAITEMENT,
  StatutDemande.PRETE,
  StatutDemande.REMISE,
];

export const DEMANDE_INCLUDE = {
  etudiant: {
    select: {
      id: true,
      matricule: true,
      nom: true,
      prenom: true,
      telephone: true,
      email: true,
    },
  },
  inscription: { select: { id: true, numero: true } },
  paiement: { select: { id: true, reference: true, statut: true, montant: true, devise: true, mode: true } },
  traitePar: { select: { id: true, nom: true, prenom: true, role: true } },
} satisfies Prisma.DemandeDocumentInclude;

@Injectable()
export class DocumentsDemandeService extends CrudService {
  private readonly logger = new Logger(DocumentsDemandeService.name);

  constructor(prisma: PrismaService) {
    super(prisma, 'demandeDocument', {
      orderBy: { creeLe: 'desc' },
      include: DEMANDE_INCLUDE,
      label: 'Demande de document',
    });
  }

  /** Année portée par le numéro "DOC-AAAA-NNNNN". */
  private anneeNumero(): string {
    return String(new Date().getFullYear());
  }

  /** Numéro séquentiel par année : "DOC-2026-00001". */
  private async prochainNumero(
    tx: Prisma.TransactionClient,
    annee: string,
  ): Promise<string> {
    const prefixe = `${PREFIX_DEMANDE}${annee}-`;
    const existantes = await tx.demandeDocument.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    });
    const max = existantes.reduce((m, r) => {
      const n = Number(r.numero.slice(prefixe.length));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return `${prefixe}${String(max + 1).padStart(5, '0')}`;
  }

  /** Numéro séquentiel "PAY-AAAA-NNNNN" pour le paiement lié. */
  private async prochainNumeroPaiement(
    tx: Prisma.TransactionClient,
    annee: string,
  ): Promise<string> {
    const prefixe = `PAY-${annee}-`;
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

  // ---------------------------------------------------------- lecture

  async liste(
    query: {
      page?: number;
      pageSize?: number;
      all?: string;
      search?: string;
      statut?: StatutDemande;
      type?: TypeDemandeDocument;
      etudiantId?: string;
    },
    user: AuthUser,
  ) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.DemandeDocumentWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.etudiantId ? { etudiantId: query.etudiantId } : {}),
      ...(query.search
        ? {
            OR: [
              { numero: { contains: query.search, mode: 'insensitive' } },
              { motif: { contains: query.search, mode: 'insensitive' } },
              {
                etudiant: {
                  OR: [
                    { nom: { contains: query.search, mode: 'insensitive' } },
                    { prenom: { contains: query.search, mode: 'insensitive' } },
                    { matricule: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.demandeDocument.findMany({
        where,
        include: DEMANDE_INCLUDE,
        orderBy: { creeLe: 'desc' },
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.demandeDocument.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  /** Vue propre à l'étudiant connecté : strictement ses demandes. */
  async mesDemandes(
    query: {
      page?: number;
      pageSize?: number;
      all?: string;
      statut?: StatutDemande;
    },
    user: AuthUser,
  ) {
    if (!user.etudiantId) {
      throw new NotFoundException('Aucun dossier étudiant rattaché à ce compte');
    }
    return this.liste({ ...query, etudiantId: user.etudiantId }, user);
  }

  /**
   * Détail d'une demande : propriétaire (étudiant) ou staff. Un étudiant qui
   * demande une autre fiche reçoit 404 — pas 403, pour ne pas confirmer
   * l'existence d'un identifiant qui n'est pas le sien.
   */
  async findOnePour(id: string, user: AuthUser) {
    const demande = await this.findOne(id);
    const estStaff =
      user.role === 'ADMIN' || user.role === 'SCOLARITE' || user.role === 'DIRECTION';
    if (!estStaff && demande.etudiantId !== user.etudiantId) {
      throw new NotFoundException('Demande introuvable');
    }
    return demande;
  }

  /**
   * Petite agrégation pour le tableau de bord :
   *  - total
   *  - compteurs par statut
   *  - montant cumulé des paiements réussis
   *  - demandes PRETE depuis plus de 7 jours (non remises)
   */
  async dashboard() {
    const ilYA7j = new Date(Date.now() - 7 * 86400 * 1000);

    const [total, parStatut, paiements, pretesNonRemises] = await Promise.all([
      this.prisma.demandeDocument.count(),
      this.prisma.demandeDocument.groupBy({
        by: ['statut'],
        _count: { _all: true },
      }),
      this.prisma.demandeDocument.aggregate({
        where: { paiement: { statut: StatutPaiement.REUSSI } },
        _sum: { frais: true },
      }),
      this.prisma.demandeDocument.count({
        where: {
          statut: StatutDemande.PRETE,
          creeLe: { lt: ilYA7j },
        },
      }),
    ]);

    const comptes: Record<StatutDemande, number> = {
      EN_ATTENTE_PAIEMENT: 0,
      PAYEE: 0,
      EN_TRAITEMENT: 0,
      PRETE: 0,
      REMISE: 0,
      REJETEE: 0,
    };
    for (const ligne of parStatut) comptes[ligne.statut] = ligne._count._all;

    return {
      total,
      ...comptes,
      recettes: paiements._sum.frais ?? 0,
      pretesNonRemises,
    };
  }

  // ---------------------------------------------------------- tarifs

  /** Liste des tarifs par type — toute personne connectée peut la consulter. */
  async listeTarifs() {
    return this.prisma.tarifDemande.findMany({ orderBy: { type: 'asc' } });
  }

  /** Lecture d'un tarif par identifiant. */
  async findTarif(id: string) {
    const tarif = await this.prisma.tarifDemande.findUnique({ where: { id } });
    if (!tarif) throw new NotFoundException('Tarif introuvable');
    return tarif;
  }

  /** Lecture d'un tarif par type — utilisé à la création d'une demande. */
  async tarifPour(type: TypeDemandeDocument) {
    return this.prisma.tarifDemande.findUnique({ where: { type } });
  }

  /** Création d'un tarif (ADMIN). */
  async creerTarif(dto: { type: TypeDemandeDocument; montant: number; delaiHeures: number }) {
    for (let tentative = 0; tentative < 5; tentative++) {
      try {
        return await this.prisma.tarifDemande.create({
          data: { type: dto.type, montant: dto.montant, delaiHeures: dto.delaiHeures },
        });
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException(
            `Un tarif existe déjà pour le type ${dto.type} : modifiez-le plutôt que d'en créer un nouveau.`,
          );
        }
        throw e;
      }
    }
    throw new ConflictException('Création temporairement indisponible, réessayez.');
  }

  /** Mise à jour d'un tarif (ADMIN). */
  async modifierTarif(id: string, dto: { montant?: number; delaiHeures?: number }) {
    await this.findTarif(id);
    return this.prisma.tarifDemande.update({
      where: { id },
      data: {
        ...(dto.montant != null ? { montant: dto.montant } : {}),
        ...(dto.delaiHeures != null ? { delaiHeures: dto.delaiHeures } : {}),
      },
    });
  }

  // ---------------------------------------------------------- création

  /**
   * Création d'une demande par l'étudiant. Le tarif est lu sur TarifDemande
   * (paramétrable). Si aucun tarif n'est défini pour ce type, le montant est
   * 0 — la demande est alors créée sans paiement attendu (workflow dégradé).
   */
  async creer(
    dto: { type: TypeDemandeDocument; motif?: string; inscriptionId?: string },
    user: AuthUser,
  ) {
    if (!user.etudiantId) {
      throw new NotFoundException('Aucun dossier étudiant rattaché à ce compte');
    }
    const tarif = await this.tarifPour(dto.type);
    const frais = tarif?.montant ?? 0;
    const devise = tarif?.devise ?? 'GNF';
    const annee = this.anneeNumero();

    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const demande = await this.prisma.$transaction(async (tx) => {
          const numero = await this.prochainNumero(tx, annee);
          return tx.demandeDocument.create({
            data: {
              numero,
              type: dto.type,
              motif: dto.motif?.trim() || null,
              etudiantId: user.etudiantId!,
              inscriptionId: dto.inscriptionId ?? null,
              frais,
              devise,
              statut:
                frais > 0
                  ? StatutDemande.EN_ATTENTE_PAIEMENT
                  : StatutDemande.EN_TRAITEMENT,
              traiteParId: frais > 0 ? null : user.id,
            },
            include: DEMANDE_INCLUDE,
          });
        });

        await this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'DEMANDE_DOC_OUVERTE',
            entite: 'DemandeDocument',
            entiteId: demande.id,
            details: `${demande.numero} — ${demande.type} (frais ${frais} ${devise})`,
          },
        });
        return demande;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException('Numéro de demande temporairement indisponible, réessayez.');
  }

  // ---------------------------------------------------------- paiement

  /**
   * Création du paiement associé à la demande. En Mobile Money, la demande
   * est transmise à l'opérateur (ou simulée en pilote sans URL). En ESPECES
   * ou VIREMENT, le paiement reste EN_ATTENTE et la scolarité confirme.
   */
  async payer(
    id: string,
    dto: { mode: ModePaiement; simuler?: boolean; operateur?: string; telephone?: string },
    user: AuthUser,
  ) {
    const demande = await this.findOnePour(id, user);
    if (demande.etudiantId !== user.etudiantId) {
      throw new BadRequestException('Seul le demandeur peut payer sa propre demande.');
    }
    if (demande.frais <= 0) {
      throw new BadRequestException(
        'Cette demande est sans frais : inutile de payer, elle est déjà en traitement.',
      );
    }
    if (demande.statut !== StatutDemande.EN_ATTENTE_PAIEMENT) {
      throw new BadRequestException(
        'Cette demande n\'est plus en attente de paiement.',
      );
    }
    if (demande.paiementId) {
      throw new BadRequestException(
        'Un paiement a déjà été initié pour cette demande : attendez la confirmation ou contactez la scolarité.',
      );
    }

    const annee = this.anneeNumero();
    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const paiement = await this.prisma.$transaction(async (tx) => {
          const reference = await this.prochainNumeroPaiement(tx, annee);
          return tx.paiement.create({
            data: {
              reference,
              montant: demande.frais,
              devise: demande.devise,
              mode: dto.mode,
              operateur: dto.operateur ?? null,
              telephone: dto.telephone ?? null,
              motif: `Demande ${demande.numero} (${demande.type})`,
              statut: StatutPaiement.EN_ATTENTE,
              etudiantId: demande.etudiantId,
              creeParId: user.id,
              demandeDocument: { connect: { id: demande.id } },
            },
          });
        });

        await this.prisma.demandeDocument.update({
          where: { id: demande.id },
          data: { paiementId: paiement.id },
        });

        // Mode pilote : la simulation force la confirmation automatique.
        if (dto.simuler) {
          await this.confirmerPaiement(demande.id, { paiementId: paiement.id }, user);
          return this.findOne(demande.id);
        }

        // Mobile Money : tentative de transmission à l'opérateur.
        if (dto.mode === ModePaiement.MOBILE_MONEY && paiement.telephone) {
          await this.tenterTransmissionMobileMoney(paiement);
        }

        await this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'DEMANDE_DOC_PAIEMENT_INITIE',
            entite: 'Paiement',
            entiteId: paiement.id,
            details: `${paiement.reference} — ${paiement.montant} ${paiement.devise} (${paiement.mode}) pour ${demande.numero}`,
          },
        });
        return this.findOne(demande.id);
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException('Référence de paiement temporairement indisponible, réessayez.');
  }

  /** Confirmation manuelle d'un paiement (ADMIN, SCOLARITE) — agent au guichet. */
  async confirmerPaiement(
    id: string,
    dto: { paiementId?: string },
    user: AuthUser,
  ) {
    const demande = await this.findOne(id);
    if (demande.statut !== StatutDemande.EN_ATTENTE_PAIEMENT) {
      throw new BadRequestException(
        'Cette demande n\'est plus en attente de paiement : elle est déjà traitée.',
      );
    }
    if (!demande.paiementId) {
      throw new BadRequestException(
        'Aucun paiement associé à cette demande : l\'étudiant doit d\'abord initier le paiement.',
      );
    }
    if (dto.paiementId && dto.paiementId !== demande.paiementId) {
      throw new BadRequestException('Identifiant de paiement incohérent.');
    }

    const paiement = await this.prisma.paiement.update({
      where: { id: demande.paiementId },
      data: { statut: StatutPaiement.REUSSI, completeLe: new Date() },
    });

    await this.prisma.demandeDocument.update({
      where: { id },
      data: { statut: StatutDemande.EN_TRAITEMENT, traiteParId: user.id },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DEMANDE_DOC_PAIEMENT_CONFIRME',
        entite: 'Paiement',
        entiteId: paiement.id,
        details: `${paiement.reference} → REUSSI pour ${demande.numero}`,
      },
    });
    return this.findOne(id);
  }

  // ---------------------------------------------------------- traitement

  /** Lancement explicite du traitement (ADMIN, SCOLARITE). */
  async lancerTraitement(id: string, user: AuthUser) {
    const demande = await this.findOne(id);
    if (demande.statut !== StatutDemande.PAYEE && demande.statut !== StatutDemande.EN_TRAITEMENT) {
      throw new BadRequestException(
        'Cette demande n\'est pas encore prête à être traitée : paiement en attente ou déjà terminée.',
      );
    }

    const miseAJour = await this.prisma.demandeDocument.update({
      where: { id },
      data: { statut: StatutDemande.EN_TRAITEMENT, traiteParId: user.id },
      include: DEMANDE_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DEMANDE_DOC_TRAITEMENT',
        entite: 'DemandeDocument',
        entiteId: id,
        details: `${miseAJour.numero} — traitement lancé`,
      },
    });
    return miseAJour;
  }

  /**
   * Marquage PRETE : la scolarité a produit le document. Une notification SMS
   * est émise à l'étudiant (via Notification) avec le message transmis par
   * le guichet. La notification ne part que si l'étudiant a un téléphone.
   */
  async marquerPrete(
    id: string,
    dto: { message?: string },
    user: AuthUser,
  ) {
    const demande = await this.findOne(id);
    if (!STATUTS_PAIEMENT_REQUIS.includes(demande.statut)) {
      throw new BadRequestException(
        'Cette demande n\'est pas encore traitée — le paiement ou la prise en charge manque.',
      );
    }
    if (demande.statut === StatutDemande.PRETE || demande.statut === StatutDemande.REMISE) {
      throw new BadRequestException('Cette demande est déjà prête ou remise.');
    }

    const message =
      dto.message?.trim() ||
      `Votre document ${demande.numero} (${this.libelleType(demande.type)}) est prêt : retirez-le au guichet de la scolarité.`;

    const miseAJour = await this.prisma.demandeDocument.update({
      where: { id },
      data: {
        statut: StatutDemande.PRETE,
        notification: message,
        traiteParId: user.id,
      },
      include: DEMANDE_INCLUDE,
    });

    // Notification SMS — best effort, sans bloquer le flux en cas d'échec.
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { id: demande.etudiantId },
      select: { telephone: true, matricule: true, nom: true, prenom: true },
    });
    if (etudiant?.telephone) {
      const numero = String(etudiant.telephone).replace(/\D/g, '');
      if (numero.length >= 8) {
        try {
          await this.prisma.notification.create({
            data: {
              telephone: numero,
              message: message.slice(0, 160),
              motif: 'DOCUMENT_PRET',
              destinataireNom: `${etudiant.prenom} ${etudiant.nom}`.trim(),
              etudiantId: etudiant.matricule ? undefined : undefined,
              statut: StatutNotification.ENVOYEE,
              envoyeParId: user.id,
              envoyeLe: new Date(),
            },
          });
        } catch (e: any) {
          this.logger.warn(
            `Notification PRETE non consignée pour ${demande.numero} : ${e?.message ?? e}`,
          );
        }
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DEMANDE_DOC_PRETE',
        entite: 'DemandeDocument',
        entiteId: id,
        details: `${miseAJour.numero} — prêt, notification envoyée`,
      },
    });
    return miseAJour;
  }

  /** Remise effective au guichet : passe en REMISE et date remiseLe. */
  async remettre(
    id: string,
    dto: { noteRemise?: string },
    user: AuthUser,
  ) {
    const demande = await this.findOne(id);
    if (demande.statut !== StatutDemande.PRETE) {
      throw new BadRequestException(
        'Cette demande n\'est pas marquée comme prête.',
      );
    }

    const data: Prisma.DemandeDocumentUpdateInput = {
      statut: StatutDemande.REMISE,
      remiseLe: new Date(),
      traitePar: { connect: { id: user.id } },
    };
    if (dto.noteRemise?.trim()) {
      const note = dto.noteRemise.trim();
      data.notes = demande.notes ? `${demande.notes}\n[${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${user.prenom} ${user.nom}] REMISE — ${note}` : `REMISE — ${note}`;
    }

    const miseAJour = await this.prisma.demandeDocument.update({
      where: { id },
      data,
      include: DEMANDE_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DEMANDE_DOC_REMISE',
        entite: 'DemandeDocument',
        entiteId: id,
        details: `${miseAJour.numero} — remise`,
      },
    });
    return miseAJour;
  }

  /** Rejet avec motif obligatoire. */
  async rejeter(id: string, dto: { motif: string }, user: AuthUser) {
    const demande = await this.findOne(id);
    if (!dto.motif?.trim()) {
      throw new BadRequestException('Le motif de rejet est obligatoire.');
    }
    if (demande.statut === StatutDemande.REMISE) {
      throw new BadRequestException('Cette demande a déjà été remise.');
    }

    const data: Prisma.DemandeDocumentUpdateInput = {
      statut: StatutDemande.REJETEE,
      notes: demande.notes
        ? `${demande.notes}\n[${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${user.prenom} ${user.nom}] REJET — ${dto.motif.trim()}`
        : `REJET — ${dto.motif.trim()}`,
    };

    const miseAJour = await this.prisma.demandeDocument.update({
      where: { id },
      data,
      include: DEMANDE_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DEMANDE_DOC_REJETEE',
        entite: 'DemandeDocument',
        entiteId: id,
        details: `${miseAJour.numero} — rejet : ${dto.motif.slice(0, 120)}`,
      },
    });
    return miseAJour;
  }

  // ---------------------------------------------------------- impression

  /**
   * Document imprimable A4 — sans en-tête Authorization, le jeton JWT est
   * vérifié à la main (même motif que les attestations).
   */
  async imprimer(id: string, token: string | undefined, jwt: { verify(t: string): any }) {
    try {
      await jwt.verify(token ?? '');
    } catch {
      const err = new Error('Jeton invalide ou expiré');
      (err as any).status = 401;
      throw err;
    }
    return this.findOne(id);
  }

  // ---------------------------------------------------------- helpers

  /**
   * Tentative de transmission Mobile Money. La passerelle est facultative —
   * en son absence, le paiement reste EN_ATTENTE et sera confirmé au guichet.
   */
  private async tenterTransmissionMobileMoney(paiement: {
    id: string;
    reference: string;
    montant: number;
    devise: string;
    operateur: string | null;
    telephone: string | null;
    motif: string | null;
  }) {
    const url = process.env.MOBILE_MONEY_URL?.replace(/\/+$/, '');
    if (!url || !paiement.telephone) return;
    const cle = process.env.MOBILE_MONEY_API_KEY;
    try {
      const reponse = await fetch(`${url}/paiements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cle ? { Authorization: `Bearer ${cle}` } : {}),
        },
        body: JSON.stringify({
          reference: paiement.reference,
          montant: paiement.montant,
          devise: paiement.devise,
          operateur: paiement.operateur ?? 'AUTRE',
          telephone: paiement.telephone,
          motif: paiement.motif ?? null,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!reponse.ok) {
        this.logger.warn(
          `Mobile Money ${paiement.reference} refusé : ${reponse.status} — le paiement reste en attente.`,
        );
      } else {
        const corps: any = await reponse.json().catch(() => ({}));
        if (corps?.transactionId) {
          await this.prisma.paiement.update({
            where: { id: paiement.id },
            data: { transactionId: corps.transactionId },
          });
        }
      }
    } catch (e: any) {
      this.logger.warn(
        `Mobile Money ${paiement.reference} injoignable : ${e?.message ?? e} — le paiement reste en attente.`,
      );
    }
  }

  /** Libellé humain d'un type de document, pour les messages SMS. */
  private libelleType(t: TypeDemandeDocument): string {
    const libelles: Record<TypeDemandeDocument, string> = {
      ATTESTATION_SCOLARITE: "attestation de scolarité",
      ATTESTATION_FREQUENTATION: "attestation de fréquentation",
      RELEVE_NOTES: 'relevé de notes',
      DUPLICATA_CARTE: 'duplicata de carte',
      ATTESTATION_REUSSITE: "attestation de réussite",
      CERTIFICAT_SCOLARITE: 'certificat de scolarité',
      AUTRE: 'document',
    };
    return libelles[t] ?? 'document';
  }
}