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
import { Prisma, StatutCourrier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated } from '../../common/dto';
import { toDateOnly } from '../../common/utils';
import {
  CloturerCourrierDto,
  CourrierQueryDto,
  CreateCourrierDto,
  ParapherCourrierDto,
  UpdateCourrierDto,
} from './courrier.dto';

const COURRIER_INCLUDE = {
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

@Injectable()
export class CourrierService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------- lecture

  async liste(query: CourrierQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.CourrierWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.enregistreParId ? { enregistreParId: query.enregistreParId } : {}),
    };
    const plage: Prisma.DateTimeFilter = {};
    if (query.dateDebut) plage.gte = toDateOnly(query.dateDebut);
    if (query.dateFin) plage.lte = toDateOnly(query.dateFin);
    if (Object.keys(plage).length) {
      where.OR = [
        { dateReception: plage },
        { dateEnvoi: plage },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.courrier.findMany({
        where,
        include: COURRIER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.courrier.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async trouver(id: string) {
    const courrier = await this.prisma.courrier.findUnique({
      where: { id },
      include: COURRIER_INCLUDE,
    });
    if (!courrier) throw new NotFoundException('Courrier introuvable');
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
    const etapes = dto.circuit?.length ? dto.circuit : CIRCUIT_PAR_DEFAUT;
    return this.prisma.$transaction(async (tx) => {
      const courrier = await tx.courrier.create({
        data: {
          numero: dto.numero,
          type: dto.type,
          objet: dto.objet,
          expediteur: dto.expediteur ?? null,
          destinataire: dto.destinataire ?? null,
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

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'COURRIER_CREE',
          entite: 'Courrier',
          entiteId: courrier.id,
          details: `${courrier.numero} — ${courrier.type} — ${courrier.objet}`,
        },
      });
      return courrier;
    });
  }

  async modifier(id: string, dto: UpdateCourrierDto, user: AuthUser) {
    const actuel = await this.trouver(id);
    const maj = await this.prisma.courrier.update({
      where: { id },
      data: {
        objet: dto.objet ?? actuel.objet,
        expediteur: dto.expediteur ?? actuel.expediteur,
        destinataire: dto.destinataire ?? actuel.destinataire,
        dateReception: dto.dateReception
          ? toDateOnly(dto.dateReception)
          : actuel.dateReception,
        dateEnvoi: dto.dateEnvoi ? toDateOnly(dto.dateEnvoi) : actuel.dateEnvoi,
        fichier: dto.fichier ?? actuel.fichier,
        typeMime: dto.typeMime ?? actuel.typeMime,
        tailleKo: dto.tailleKo ?? actuel.tailleKo,
        numeroReference: dto.numeroReference ?? actuel.numeroReference,
        paraphe: dto.paraphe ?? actuel.paraphe,
        notes: dto.notes ?? actuel.notes,
        statut: dto.statut ?? actuel.statut,
      },
      include: COURRIER_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'COURRIER_MODIFIE',
        entite: 'Courrier',
        entiteId: id,
        details: `${maj.numero}`,
      },
    });
    return maj;
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
    const courrier = await this.trouver(id);
    if (courrier.statut !== StatutCourrier.EN_CIRCUIT) {
      throw new BadRequestException(
        `Courrier ${courrier.statut} : seul un courrier EN_CIRCUIT peut être paraphé`,
      );
    }
    const etape = await this.prisma.circuitCourrier.findUnique({
      where: { id: circuitId },
    });
    if (!etape || etape.courrierId !== id) {
      throw new NotFoundException('Étape de circuit introuvable pour ce courrier');
    }

    // Le valideur autorisé : ici on ne contraint pas par rôle, on trace qui a
    // fait quoi. Tout utilisateur connecté peut parapher une étape ouverte
    // (le `Role` du valideur reste une information documentaire sur l'étape).
    if (etape.statut !== StatutCourrier.EN_CIRCUIT) {
      throw new BadRequestException("Cette étape a déjà été traitée");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.circuitCourrier.update({
        where: { id: circuitId },
        data: {
          valideurId: user.id,
          statut: StatutCourrier.TRAITE,
          paraphe: dto.paraphe ?? null,
          parapheLe: new Date(),
          commentaire: dto.commentaire ?? null,
        },
      });

      // S'il reste des étapes non traitées, le courrier reste EN_CIRCUIT.
      // Sinon il passe TRAITE.
      const restantes = await tx.circuitCourrier.count({
        where: { courrierId: id, statut: StatutCourrier.EN_CIRCUIT },
      });

      if (restantes === 0) {
        return tx.courrier.update({
          where: { id },
          data: {
            statut: StatutCourrier.TRAITE,
            traiteParId: user.id,
          },
          include: COURRIER_INCLUDE,
        });
      }
      return tx.courrier.findUnique({
        where: { id },
        include: COURRIER_INCLUDE,
      });
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'COURRIER_PARAPHE',
        entite: 'Courrier',
        entiteId: id,
        details: `Étape ${etape.ordre} (${etape.roleValideur}) — ${updated?.statut ?? ''}`,
      },
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
      throw new ForbiddenException(
        "Seul un administrateur peut clôturer un courrier (transition vers les archives)",
      );
    }
    const courrier = await this.trouver(id);
    const autorisees: StatutCourrier[] = [
      StatutCourrier.EN_CIRCUIT,
      StatutCourrier.TRAITE,
      StatutCourrier.CLASSE,
    ];
    if (!autorisees.includes(courrier.statut)) {
      throw new BadRequestException(
        `Courrier ${courrier.statut} : la clôture exige EN_CIRCUIT, TRAITE ou CLASSE`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
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

      return tx.courrier.update({
        where: { id },
        data: {
          statut: statutSuivant,
          ...(statutSuivant === StatutCourrier.TRAITE ? { traiteParId: user.id } : {}),
          ...(dto.notes ? { notes: dto.notes } : {}),
        },
        include: COURRIER_INCLUDE,
      });
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'COURRIER_CLOTURE',
        entite: 'Courrier',
        entiteId: id,
        details: `${updated.numero} → ${updated.statut}`,
      },
    });
    return updated;
  }

  // ------------------------------------------------------ impression

  /**
   * Feuille A4 du courrier. Pas d'en-tête Authorization (window.open) : le jeton
   * est vérifié manuellement dans le contrôleur avant l'appel à ce service.
   */
  async imprimer(id: string): Promise<string> {
    const c = await this.trouver(id);

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

function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
