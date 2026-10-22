/**
 * Module Courrier — enregistrement et circulation des courriers administratifs
 * (entrants et sortants) avec circuit de paraphe multi-étapes.
 *
 * Cycle de vie d'un courrier :
 *   RECU → ENREGISTRE → EN_CIRCUIT → TRAITE → CLASSE → ARCHIVE
 *
 * À la création d'un courrier entrant en RECU, le service crée automatiquement
 * un circuit par défaut (secrétariat → chef → archives) sauf si le DTO fournit
 * une liste d'étapes. Chaque étape est ensuite paraphée par son valideur ;
 * lorsque la dernière étape est franchie, le courrier passe en TRAITE, puis
 * il est clôturé manuellement (CLASSE), puis archivé (ARCHIVE).
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StatutCourrier } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated } from '../../common/dto';
import { echapper, toDateOnly } from '../../common/utils';
import {
  CloturerCourrierDto,
  CourrierQueryDto,
  CreateCourrierDto,
  ParapherCourrierDto,
  UpdateCourrierDto,
} from './courrier.dto';
import { paginer, pagine } from '../../common/pagination';
import { journaliser } from '../../common/audit';
import { estChefDeDepartement, filtreDepartement } from '../../common/perimetre';

const COURRIER_INCLUDE = {
  departement: { select: { id: true, code: true, nom: true } },
  circuits: {
    include: {
      valideur: { select: { id: true, nom: true, prenom: true, role: true } },
    },
    orderBy: { ordre: 'asc' },
  },
  enregistrePar: { select: { id: true, nom: true, prenom: true } },
  traitePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.CourrierInclude;

/** Circuit par défaut : secrétariat (1) → chef département (2) → archives (3). */
const CIRCUIT_PAR_DEFAUT = [
  { ordre: 1, roleValideur: 'Secrétariat' },
  { ordre: 2, roleValideur: 'Chef département' },
  { ordre: 3, roleValideur: 'Archives' },
];

const ETIQUETTES_PAR_ROLE: Partial<Record<Role, string[]>> = {
  [Role.ADMIN]: ['Administration'],
  [Role.DIRECTION]: ['Direction', 'Recteur'],
  [Role.SCOLARITE]: ['Secrétariat', 'Secrétariat général', 'Scolarité', 'Archives'],
  [Role.CHEF_DEPARTEMENT]: ['Chef département', 'Chef de département'],
};

@Injectable()
export class CourrierService {
  constructor(private prisma: PrismaService) {}

  private estResponsable(user: AuthUser) {
    return user.role === Role.ADMIN || user.role === Role.DIRECTION;
  }

  private peutConsulter(courrier: { departementId?: string | null; enregistreParId: string | null; circuits: Array<{ roleValideur: string | null }> }, user: AuthUser) {
    if (estChefDeDepartement(user) && (!user.departementId || courrier.departementId !== user.departementId)) return false;
    if (this.estResponsable(user) || courrier.enregistreParId === user.id) return true;
    const etiquettes = ETIQUETTES_PAR_ROLE[user.role] ?? [];
    return courrier.circuits.some((etape) => etiquettes.includes(etape.roleValideur ?? ''));
  }

  private exigerAcces(courrier: Parameters<CourrierService['peutConsulter']>[0], user: AuthUser) {
    if (!this.peutConsulter(courrier, user)) {
      throw new NotFoundException(I18nContext.current()!.t('courrier.courrier_introuvable'));
    }
  }

  /**
   * Projection minimale journalisée avant/après. Un courrier concentre des
   * données sensibles — pièce jointe (data-URL du PDF scanné), objet,
   * expediteur/destinataire, notes et commentaires libres, hash de paraphe :
   * le journal n'en retient que l'identification, la situation et l'avancement
   * du circuit. La présence d'un fichier ou d'un paraphe est notée par un
   * booléen, jamais par son contenu.
   */
  private instantaneAudit(courrier: any) {
    return {
      id: courrier.id,
      numero: courrier.numero,
      type: courrier.type,
      statut: courrier.statut,
      dateReception: courrier.dateReception ?? null,
      dateEnvoi: courrier.dateEnvoi ?? null,
      fichierJoint: Boolean(courrier.fichier),
      parapheFourni: Boolean(courrier.paraphe),
      enregistreParId: courrier.enregistreParId ?? null,
      departementId: courrier.departementId ?? null,
      traiteParId: courrier.traiteParId ?? null,
      circuit: [...(courrier.circuits ?? [])]
        .sort((a: any, b: any) => a.ordre - b.ordre)
        .map((etape: any) => ({
          id: etape.id,
          ordre: etape.ordre,
          roleValideur: etape.roleValideur ?? null,
          statut: etape.statut,
          valideurId: etape.valideurId ?? null,
          parapheFourni: Boolean(etape.paraphe),
          parapheLe: etape.parapheLe ?? null,
          commentaireFourni: Boolean(etape.commentaire),
        })),
    };
  }

  private filtreVisible(user: AuthUser): Prisma.CourrierWhereInput {
    if (this.estResponsable(user)) return {};
    const etiquettes = ETIQUETTES_PAR_ROLE[user.role] ?? [];
    return {
      ...filtreDepartement(user, '', '__aucun_departement__'),
      OR: [
        { enregistreParId: user.id },
        ...(etiquettes.length ? [{ circuits: { some: { roleValideur: { in: etiquettes } } } }] : []),
      ],
    };
  }

  // ------------------------------------------------------- lecture

  async liste(query: CourrierQueryDto, user: AuthUser): Promise<Paginated<any>> {
    const pagination = paginer(query);

    const scope = this.filtreVisible(user);
    const where: Prisma.CourrierWhereInput = {
      ...scope,
      ...(query.type ? { type: query.type } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.enregistreParId ? { enregistreParId: query.enregistreParId } : {}),
    };
    const plage: Prisma.DateTimeFilter = {};
    if (query.dateDebut) plage.gte = toDateOnly(query.dateDebut);
    if (query.dateFin) plage.lte = toDateOnly(query.dateFin);
    if (Object.keys(plage).length) {
      const plageCreation: Prisma.DateTimeFilter = {
        ...(query.dateDebut ? { gte: toDateOnly(query.dateDebut) } : {}),
        // createdAt porte une heure : inclure toute la dernière journée.
        ...(query.dateFin ? { lt: new Date(toDateOnly(query.dateFin).getTime() + 86_400_000) } : {}),
      };
      where.AND = [
        {
          OR: [
            { dateReception: plage },
            { dateEnvoi: plage },
            { dateReception: null, dateEnvoi: null, createdAt: plageCreation },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.courrier.findMany({
        where,
        include: COURRIER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.courrier.count({ where }),
    ]);
    return pagine(data, total, pagination);
  }

  async trouver(id: string, user: AuthUser) {
    const courrier = await this.prisma.courrier.findFirst({
      where: { id, ...this.filtreVisible(user) },
      include: COURRIER_INCLUDE,
    });
    if (!courrier) throw new NotFoundException(I18nContext.current()!.t('courrier.courrier_introuvable'));
    this.exigerAcces(courrier, user);
    return courrier;
  }

  // ----------------------------------------------------- dashboard

  async dashboard() {
    const [parStatut, parType, recents] = await Promise.all([
      this.prisma.courrier.groupBy({
        by: ['statut'],
        _count: { _all: true },
      }),
      this.prisma.courrier.groupBy({
        by: ['type'],
        _count: { _all: true },
      }),
      this.prisma.courrier.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { enregistrePar: { select: { id: true, nom: true, prenom: true } } },
      }),
    ]);
    return {
      parStatut,
      parType,
      recents,
      total: parStatut.reduce((t, s) => t + s._count._all, 0),
    };
  }

  // ----------------------------------------------- création + circuit

  async creer(dto: CreateCourrierDto, user: AuthUser) {
    const departementId = estChefDeDepartement(user) ? user.departementId : dto.departementId;
    if (estChefDeDepartement(user) && (!departementId || (dto.departementId && dto.departementId !== departementId))) {
      throw new ForbiddenException(I18nContext.current()!.t('courrier.department_scope_required'));
    }
    const etapes = dto.circuit?.length ? dto.circuit : CIRCUIT_PAR_DEFAUT;
    return this.prisma.$transaction(async (tx) => {
      if (departementId && !await tx.departement.findUnique({ where: { id: departementId }, select: { id: true } })) {
        throw new BadRequestException(I18nContext.current()!.t('courrier.department_invalid'));
      }
      const courrier = await tx.courrier.create({
        data: {
          numero: dto.numero,
          type: dto.type,
          objet: dto.objet,
          expediteur: dto.expediteur ?? null,
          destinataire: dto.destinataire ?? null,
          departementId: departementId ?? null,
          dateReception: dto.dateReception ? toDateOnly(dto.dateReception) : null,
          dateEnvoi: dto.dateEnvoi ? toDateOnly(dto.dateEnvoi) : null,
          fichier: dto.fichier ?? null,
          typeMime: dto.typeMime ?? null,
          tailleKo: dto.tailleKo ?? null,
          numeroReference: dto.numeroReference ?? null,
          paraphe: dto.paraphe ?? null,
          notes: dto.notes ?? null,
          statut: etapes.length ? StatutCourrier.EN_CIRCUIT : StatutCourrier.RECU,
          enregistreParId: user.id,
          ...(etapes.length
            ? {
                circuits: {
                  create: etapes.map((e) => ({
                    ordre: e.ordre,
                    roleValideur: e.roleValideur,
                    statut: StatutCourrier.EN_CIRCUIT,
                  })),
                },
              }
            : {}),
        },
        include: COURRIER_INCLUDE,
      });

      await journaliser(
        tx,
        user,
        'COURRIER_CREE',
        'Courrier',
        courrier.id,
        {
            avant: null,
            apres: this.instantaneAudit(courrier),
          },
      );
      return courrier;
    });
  }

  async modifier(id: string, dto: UpdateCourrierDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.verrouiller(tx, id);
      const actuel = await tx.courrier.findFirst({
        where: { id, ...this.filtreVisible(user) },
        include: COURRIER_INCLUDE,
      });
      if (!actuel) throw new NotFoundException(I18nContext.current()!.t('courrier.courrier_introuvable'));
      this.exigerAcces(actuel, user);
      if (actuel.statut === StatutCourrier.ARCHIVE) {
        throw new BadRequestException(I18nContext.current()!.t('courrier.archive_readonly'));
      }
      if (dto.statut !== undefined && dto.statut !== actuel.statut) {
        throw new ForbiddenException(I18nContext.current()!.t('courrier.status_workflow_required'));
      }
      if (dto.departementId !== undefined && dto.departementId !== actuel.departementId) {
        if (actuel.circuits.some(e => e.statut === StatutCourrier.TRAITE)) {
          throw new BadRequestException(I18nContext.current()!.t('courrier.department_routing_started'));
        }
        if (!dto.departementId || !await tx.departement.findUnique({ where: { id: dto.departementId }, select: { id: true } })) {
          throw new BadRequestException(I18nContext.current()!.t('courrier.department_invalid'));
        }
      }
      const maj = await tx.courrier.update({
        where: { id, statut: actuel.statut },
        data: {
          ...(dto.departementId !== undefined ? { departementId: dto.departementId } : {}),
          ...(dto.objet !== undefined ? { objet: dto.objet } : {}),
          ...(dto.expediteur !== undefined ? { expediteur: dto.expediteur } : {}),
          ...(dto.destinataire !== undefined ? { destinataire: dto.destinataire } : {}),
          ...(dto.dateReception !== undefined ? { dateReception: dto.dateReception ? toDateOnly(dto.dateReception) : null } : {}),
          ...(dto.dateEnvoi !== undefined ? { dateEnvoi: dto.dateEnvoi ? toDateOnly(dto.dateEnvoi) : null } : {}),
          ...(dto.fichier !== undefined ? { fichier: dto.fichier } : {}),
          ...(dto.typeMime !== undefined ? { typeMime: dto.typeMime } : {}),
          ...(dto.tailleKo !== undefined ? { tailleKo: dto.tailleKo } : {}),
          ...(dto.numeroReference !== undefined ? { numeroReference: dto.numeroReference } : {}),
          ...(dto.paraphe !== undefined ? { paraphe: dto.paraphe } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.statut !== undefined ? { statut: dto.statut } : {}),
        },
        include: COURRIER_INCLUDE,
      });

      await journaliser(
        tx,
        user,
        'COURRIER_MODIFIE',
        'Courrier',
        id,
        {
            avant: this.instantaneAudit(actuel),
            apres: this.instantaneAudit(maj),
            champsModifies: Object.keys(dto),
          },
      );
      return maj;
    });
  }

  // ------------------------------------------------- circuit / paraphe

  /**
   * Le valideur paraphé à l'étape `circuitId` :
   *   - étape courante + statut EN_CIRCUIT → TRAITE
   *   - enregsitre paraphe + parapheLe + commentaire
   *   - si la dernière étape est franchie, le courrier passe EN_CIRCUIT
   *     seulement si une nouvelle étape reste en EN_CIRCUIT, sinon TRAITE.
   */
  async parapher(id: string, circuitId: string, dto: ParapherCourrierDto, user: AuthUser) {
    const courrier = await this.trouver(id, user);
    if (courrier.statut !== StatutCourrier.EN_CIRCUIT) {
      throw new BadRequestException(
        `Courrier ${courrier.statut} : seul un courrier EN_CIRCUIT peut être paraphé`,
      );
    }
    const etape = await this.prisma.circuitCourrier.findUnique({
      where: { id: circuitId },
    });
    if (!etape || etape.courrierId !== id) {
      throw new NotFoundException(I18nContext.current()!.t('courrier.etape_de_circuit_introuvable_pour_ce_courrier'));
    }

    const rolesEtape: Record<string, Role[]> = {
      'Secrétariat': [Role.SCOLARITE],
      'Secrétariat général': [Role.SCOLARITE],
      'Scolarité': [Role.SCOLARITE],
      'Archives': [Role.SCOLARITE],
      'Chef département': [Role.CHEF_DEPARTEMENT],
      'Chef de département': [Role.CHEF_DEPARTEMENT],
      'Direction': [Role.DIRECTION],
      'Recteur': [Role.DIRECTION],
      'Administration': [Role.ADMIN],
    };
    if (!this.estResponsable(user) && !rolesEtape[etape.roleValideur ?? '']?.includes(user.role)) {
      throw new NotFoundException(I18nContext.current()!.t('courrier.etape_de_circuit_introuvable_pour_ce_courrier'));
    }

    // L'étape peut être signée une seule fois ; le rôle correspondant a déjà
    // été vérifié avant toute écriture.
    if (etape.statut !== StatutCourrier.EN_CIRCUIT) {
      throw new BadRequestException(I18nContext.current()!.t('courrier.cette_etape_a_deja_ete_traitee'));
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.verrouiller(tx, id);
      const avant = await tx.courrier.findUnique({ where: { id }, include: COURRIER_INCLUDE });
      if (!avant) throw new NotFoundException(I18nContext.current()!.t('courrier.courrier_introuvable'));
      this.exigerAcces(avant, user);
      if (avant.statut !== StatutCourrier.EN_CIRCUIT) {
        throw new BadRequestException(I18nContext.current()!.t('courrier.status_workflow_required'));
      }
      const courante = avant.circuits.find(e => e.id === circuitId);
      if (!courante) throw new NotFoundException(I18nContext.current()!.t('courrier.etape_de_circuit_introuvable_pour_ce_courrier'));
      if (avant.circuits.some(e => e.ordre < courante.ordre && e.statut !== StatutCourrier.TRAITE)) {
        throw new BadRequestException(I18nContext.current()!.t('courrier.previous_step_required'));
      }
      const signature = await tx.circuitCourrier.updateMany({
        where: { id: circuitId, courrierId: id, statut: StatutCourrier.EN_CIRCUIT },
        data: {
          valideurId: user.id,
          statut: StatutCourrier.TRAITE,
          paraphe: dto.paraphe ?? null,
          parapheLe: new Date(),
          commentaire: dto.commentaire ?? null,
        },
      });
      if (signature.count !== 1) {
        throw new BadRequestException(I18nContext.current()!.t('courrier.cette_etape_a_deja_ete_traitee'));
      }

      // S'il reste des étapes non traitées, le courrier reste EN_CIRCUIT.
      // Sinon il passe TRAITE.
      const restantes = await tx.circuitCourrier.count({
        where: { courrierId: id, statut: StatutCourrier.EN_CIRCUIT },
      });

      const apres = restantes === 0
        ? await tx.courrier.update({
            where: { id },
            data: {
              statut: StatutCourrier.TRAITE,
              traiteParId: user.id,
            },
            include: COURRIER_INCLUDE,
          })
        : await tx.courrier.findUnique({
            where: { id },
            include: COURRIER_INCLUDE,
          });

      await journaliser(
        tx,
        user,
        'COURRIER_PARAPHE',
        'Courrier',
        id,
        {
            etape: {
              id: etape.id,
              ordre: etape.ordre,
              roleValideur: etape.roleValideur ?? null,
            },
            parapheFourni: Boolean(dto.paraphe),
            commentaireFourni: Boolean(dto.commentaire),
            avant: this.instantaneAudit(avant),
            apres: apres ? this.instantaneAudit(apres) : null,
            champsModifies: restantes === 0
              ? ['circuit', 'statut', 'traiteParId']
              : ['circuit'],
          },
      );
      return apres;
    });

    return updated;
  }

  /**
   * Clôture : EN_CIRCUIT → TRAITE → CLASSE → ARCHIVE.
   * Seul l'ADMIN peut clôturer, ce qui passe :
   *   - EN_CIRCUIT → TRAITE (si pas déjà),
   *   - puis TRAITE → CLASSE,
   *   - puis CLASSE → ARCHIVE.
   */
  async cloturer(id: string, dto: CloturerCourrierDto, user: AuthUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(I18nContext.current()!.t('courrier.seul_un_administrateur_peut_cloturer_un_courrier_transition_'));
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.verrouiller(tx, id);
      const courrier = await tx.courrier.findUnique({ where: { id }, include: COURRIER_INCLUDE });
      if (!courrier) throw new NotFoundException(I18nContext.current()!.t('courrier.courrier_introuvable'));
      const autorisees: StatutCourrier[] = [
        StatutCourrier.EN_CIRCUIT,
        StatutCourrier.TRAITE,
        StatutCourrier.CLASSE,
      ];
      if (!autorisees.includes(courrier.statut)) {
        throw new BadRequestException(I18nContext.current()!.t('courrier.courrier_courrier_statut_la_cloture_exige_en_circuit_traite_', { args: { 'courrier.statut': courrier.statut } }));
      }

      // Forcer toutes les étapes encore en EN_CIRCUIT vers TRAITE (le courrier
      // est archivé même si une étape n'a pas été signée individuellement).
      await tx.circuitCourrier.updateMany({
        where: { courrierId: id, statut: StatutCourrier.EN_CIRCUIT },
        data: {
          statut: StatutCourrier.TRAITE,
          parapheLe: new Date(),
        },
      });

      const statutSuivant =
        courrier.statut === StatutCourrier.CLASSE
          ? StatutCourrier.ARCHIVE
          : courrier.statut === StatutCourrier.TRAITE
            ? StatutCourrier.CLASSE
            : StatutCourrier.TRAITE;

      const apres = await tx.courrier.update({
        where: { id, statut: courrier.statut },
        data: {
          statut: statutSuivant,
          ...(statutSuivant === StatutCourrier.TRAITE ? { traiteParId: user.id } : {}),
          ...(dto.notes ? { notes: dto.notes } : {}),
        },
        include: COURRIER_INCLUDE,
      });

      await journaliser(
        tx,
        user,
        'COURRIER_CLOTURE',
        'Courrier',
        id,
        {
            transition: `${courrier.statut}→${apres.statut}`,
            etapesForcees: true,
            notesModifiees: Boolean(dto.notes),
            avant: this.instantaneAudit(courrier),
            apres: this.instantaneAudit(apres),
            champsModifies: [
              'circuit',
              'statut',
              ...(statutSuivant === StatutCourrier.TRAITE ? ['traiteParId'] : []),
              ...(dto.notes ? ['notes'] : []),
            ],
          },
      );
      return apres;
    });

    return updated;
  }

  // ------------------------------------------------------ impression

  /** Paraphes, corrections et clôtures partagent le même verrou parent. */
  private verrouiller(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw`SELECT "id" FROM "Courrier" WHERE "id" = ${id} FOR UPDATE`;
  }

  /**
   * Feuille A4 du courrier. Pas d'en-tête Authorization (window.open) : le jeton
   * est vérifié manuellement dans le contrôleur avant l'appel à ce service.
   */
  async imprimer(id: string, user: AuthUser): Promise<string> {
    const c = await this.trouver(id, user);

    const circuits = c.circuits
      .map(
        (e) => `<tr>
          <td>${e.ordre}</td>
          <td>${echapper(e.roleValideur ?? '—')}</td>
          <td>${e.valideur ? `${echapper(e.valideur.prenom)} ${echapper(e.valideur.nom)}` : ''}</td>
          <td>${e.statut}</td>
          <td>${e.parapheLe ? echapper(new Date(e.parapheLe).toLocaleString('fr-FR')) : '—'}</td>
          <td>${echapper(e.paraphe ?? '')}</td>
        </tr>`,
      )
      .join('');

    const typeBadge = c.type === 'ENTRANT' ? 'Entrant' : 'Sortant';
    const date = c.dateReception ?? c.dateEnvoi;

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Courrier ${echapper(c.numero)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm 12mm; font-size: 12px; }
  header { border-bottom: 2px solid #10251E; padding-bottom: 8px; margin-bottom: 14px; }
  .numero { font-size: 16px; font-weight: 700; }
  .objet { font-size: 18px; font-weight: 700; margin-top: 6px; color: #0F7A45; }
  .meta { display: flex; gap: 16px; flex-wrap: wrap; margin: 12px 0; font-size: 11px; color: #555; }
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: #e3eae5; color: #10251E; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #b9c4cf; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #e8eef5; font-size: 11px; text-transform: uppercase; }
  tbody tr:nth-child(even) { background: #fafbfd; }
  .signatures { display: flex; justify-content: space-between; margin-top: 42px; }
  .signature { width: 30%; border-top: 1px solid #999; padding-top: 4px; text-align: center; color: #555; }
  footer { margin-top: 18px; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
  @media print { body { padding: 8mm; } }
  @page { size: A4; margin: 10mm; }
</style></head>
<body>
  <header>
    <div class="numero">${echapper(c.numero)} — <span class="badge">${typeBadge}</span></div>
    <div class="objet">${echapper(c.objet)}</div>
  </header>
  <div class="meta">
    ${c.expediteur ? `<span><b>Expéditeur :</b> ${echapper(c.expediteur)}</span>` : ''}
    ${c.destinataire ? `<span><b>Destinataire :</b> ${echapper(c.destinataire)}</span>` : ''}
    ${c.numeroReference ? `<span><b>Référence :</b> ${echapper(c.numeroReference)}</span>` : ''}
    ${date ? `<span><b>Date :</b> ${echapper(new Date(date).toLocaleDateString('fr-FR'))}</span>` : ''}
    <span><b>Statut :</b> ${c.statut}</span>
  </div>
  <h3 style="margin: 10px 0 4px;">Circuit de paraphe</h3>
  <table>
    <thead><tr>
      <th>#</th><th>Rôle</th><th>Valideur</th>
      <th>Statut</th><th>Date</th><th>Paraphe</th>
    </tr></thead>
    <tbody>${circuits || '<tr><td colspan="6" style="color:#777">Aucun circuit</td></tr>'}</tbody>
  </table>
  ${c.notes ? `<p style="margin-top:12px;"><b>Notes :</b> ${echapper(c.notes)}</p>` : ''}
  <div class="signatures">
    <div class="signature">Le Secrétariat</div>
    <div class="signature">Le Chef de département</div>
    <div class="signature">Les Archives</div>
  </div>
  <footer><span>UniPrésence — registre du courrier</span><span>Édité le ${new Date().toLocaleString('fr-FR')}</span></footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }
}
