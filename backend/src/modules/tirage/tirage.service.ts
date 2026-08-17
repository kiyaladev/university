/**
 * Module Tirage — tirage et distribution sécurisée des épreuves.
 *
 * Cycle de vie : PROGRAMME → IMPRIME → MIS_SOUS_PLI → DISTRIBUE → RECUPERE (ou ANNULE).
 *
 * Chaque transition est gardée par le service :
 *   - `PROGRAMME → IMPRIME` exige que l'empreinte fournie dans la requête
 *     corresponde à l'empreinte source enregistrée ;
 *   - les transitions ultérieures rejettent toute étape sautée.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { Prisma, StadeTirage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated } from '../../common/dto';
import {
  CreateTirageDto,
  ImprimerTirageDto,
  TirageQueryDto,
  UpdateStadeTirageDto,
} from './tirage.dto';

const TIRAGE_INCLUDE = {
  examen: {
    include: {
      matiere: true,
      promotion: true,
      annee: true,
      salle: true,
      surveillant: { select: { id: true, nom: true, prenom: true } },
    },
  },
  imprimeur: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.TirageInclude;

/** Transitions autorisées (source → cible). Pas de saut. */
const TRANSITIONS: Record<StadeTirage, StadeTirage | null> = {
  PROGRAMME: StadeTirage.IMPRIME,
  IMPRIME: StadeTirage.MIS_SOUS_PLI,
  MIS_SOUS_PLI: StadeTirage.DISTRIBUE,
  DISTRIBUE: StadeTirage.RECUPERE,
  RECUPERE: null,
  ANNULE: null,
};

@Injectable()
export class TirageService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------- lecture

  async liste(query: TirageQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.TirageWhereInput = {
      ...(query.stade ? { stade: query.stade } : {}),
      ...(query.examenId ? { examenId: query.examenId } : {}),
      ...(query.imprimeurId ? { imprimeurId: query.imprimeurId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.tirage.findMany({
        where,
        include: TIRAGE_INCLUDE,
        orderBy: { dateTirage: 'desc' },
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.tirage.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async trouver(id: string) {
    const tirage = await this.prisma.tirage.findUnique({
      where: { id },
      include: TIRAGE_INCLUDE,
    });
    if (!tirage) throw new NotFoundException('Tirage introuvable');
    return tirage;
  }

  // ---------------------------------------------------- création

  async creer(dto: CreateTirageDto, user: AuthUser) {
    const examen = await this.prisma.examen.findUnique({
      where: { id: dto.examenId },
    });
    if (!examen) throw new BadRequestException('Examen introuvable');

    const tirage = await this.prisma.tirage.create({
      data: {
        examenId: dto.examenId,
        dateTirage: new Date(dto.dateTirage),
        nbExemplaires: dto.nbExemplaires,
        empreinteSource: dto.empreinteSource.toLowerCase(),
        circuitImpression: dto.circuitImpression ?? null,
        notes: dto.notes ?? null,
        stade: StadeTirage.PROGRAMME,
      },
      include: TIRAGE_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'TIRAGE_CREE',
        entite: 'Tirage',
        entiteId: tirage.id,
        details: `Examen ${examen.codeExamen} — ${tirage.nbExemplaires} ex. — empreinte ${tirage.empreinteSource.slice(0, 12)}…`,
      },
    });
    return tirage;
  }

  // ------------------------------------------------ transitions

  /**
   * PROGRAMME → IMPRIME.
   * L'empreinte du fichier à imprimer doit impérativement correspondre à
   * celle qui a été déclarée à la création : c'est la garantie qu'aucune
   * version corrompue ou substituée n'a glissé dans le circuit. L'imprimeur
   * est consigné.
   */
  async imprimer(id: string, dto: ImprimerTirageDto, user: AuthUser) {
    const tirage = await this.trouver(id);
    if (tirage.stade !== StadeTirage.PROGRAMME) {
      throw new BadRequestException(
        `Tirage ${tirage.stade} : seul un tirage PROGRAMME peut être imprimé`,
      );
    }
    if (dto.empreinteSource.toLowerCase() !== tirage.empreinteSource) {
      throw new BadRequestException(
        "Empreinte source fournie ne correspond pas à celle enregistrée — impression refusée",
      );
    }

    const maj = await this.prisma.tirage.update({
      where: { id },
      data: {
        stade: StadeTirage.IMPRIME,
        imprimeurId: user.id,
        empreinteExemplaires: dto.empreinteExemplaires ?? null,
      },
      include: TIRAGE_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'TIRAGE_IMPRIME',
        entite: 'Tirage',
        entiteId: id,
        details: `${tirage.nbExemplaires} ex. — empreinte ${tirage.empreinteSource.slice(0, 12)}…`,
      },
    });
    return maj;
  }

  /** Transition générique avec garde de séquence. */
  private async transition(
    id: string,
    dto: UpdateStadeTirageDto,
    user: AuthUser,
    actionAudit: string,
  ) {
    const tirage = await this.trouver(id);
    const cible = TRANSITIONS[tirage.stade];
    if (!cible || cible !== dto.stade) {
      throw new BadRequestException(
        `Transition impossible depuis ${tirage.stade} vers ${dto.stade}`,
      );
    }
    const maj = await this.prisma.tirage.update({
      where: { id },
      data: {
        stade: dto.stade,
        ...(dto.notes ? { notes: dto.notes } : {}),
      },
      include: TIRAGE_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: actionAudit,
        entite: 'Tirage',
        entiteId: id,
        details: `${tirage.stade} → ${maj.stade}`,
      },
    });
    return maj;
  }

  mettreSousPli(id: string, dto: UpdateStadeTirageDto, user: AuthUser) {
    return this.transition(id, dto, user, 'TIRAGE_MIS_SOUS_PLI');
  }

  distribuer(id: string, dto: UpdateStadeTirageDto, user: AuthUser) {
    return this.transition(id, dto, user, 'TIRAGE_DISTRIBUE');
  }

  recuperer(id: string, dto: UpdateStadeTirageDto, user: AuthUser) {
    return this.transition(id, dto, user, 'TIRAGE_RECUPERE');
  }

  /**
   * Annulation possible seulement tant que rien n'a été imprimé. Au-delà, on
   * garde la trace mais aucune impression supplémentaire ne partira : il
   * faut créer un nouveau tirage.
   */
  async annuler(id: string, user: AuthUser) {
    const tirage = await this.trouver(id);
    if (tirage.stade !== StadeTirage.PROGRAMME) {
      throw new BadRequestException(
        `Tirage ${tirage.stade} : annulation possible uniquement depuis PROGRAMME`,
      );
    }
    const maj = await this.prisma.tirage.update({
      where: { id },
      data: { stade: StadeTirage.ANNULE },
      include: TIRAGE_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'TIRAGE_ANNULE',
        entite: 'Tirage',
        entiteId: id,
        details: `Annulation du tirage de l'examen ${tirage.examen.codeExamen}`,
      },
    });
    return maj;
  }

  // ----------------------------------------------------- bordereau

  /**
   * Bordereau A4 (remis au destinataire des épreuves). Ouvert dans un
   * nouvel onglet : pas d'en-tête Authorization, jeton vérifié côté
   * contrôleur avant l'appel.
   */
  async imprimerBordereau(id: string): Promise<string> {
    const t = await this.trouver(id);
    const empreinteCourte = (h: string | null | undefined) =>
      h ? `${h.slice(0, 16)}…` : '—';

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Bordereau tirage — ${echapper(t.examen.codeExamen)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm 14mm; font-size: 12px; }
  header { border-bottom: 2px solid #10251E; padding-bottom: 8px; margin-bottom: 14px; }
  .titre { font-size: 19px; font-weight: 700; margin: 4px 0 6px; color: #0F7A45; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 10px 0; font-size: 12px; }
  .meta b { display: inline-block; min-width: 130px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #b9c4cf; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #e8eef5; font-size: 11px; text-transform: uppercase; }
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .PROGRAMME { background: #e3eae5; color: #10251E; }
  .IMPRIME { background: #fff3cd; color: #856404; }
  .MIS_SOUS_PLI { background: #cfe5ff; color: #0d3a78; }
  .DISTRIBUE { background: #e3f5e9; color: #17683a; }
  .RECUPERE { background: #d4edda; color: #155724; }
  .ANNULE { background: #f8d7da; color: #721c24; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 60px; }
  .signature { border-top: 1px solid #999; padding-top: 4px; text-align: center; color: #555; }
  footer { margin-top: 18px; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
  @media print { body { padding: 8mm; } }
  @page { size: A4; margin: 10mm; }
</style></head>
<body>
  <header>
    <div class="titre">Bordereau de tirage — ${echapper(t.examen.codeExamen)}</div>
    <div>${echapper(t.examen.intitule)}</div>
  </header>
  <div class="meta">
    <div><b>Mention :</b> ${echapper(t.examen.promotion.nom)}</div>
    <div><b>Matière :</b> ${echapper(t.examen.matiere.intitule)}</div>
    <div><b>Année :</b> ${echapper(t.examen.annee.libelle)}</div>
    <div><b>Salle :</b> ${echapper(t.examen.salle?.code ?? '—')}</div>
    <div><b>Date examen :</b> ${echapper(new Date(t.examen.dateExamen).toLocaleString('fr-FR'))}</div>
    <div><b>Date tirage :</b> ${echapper(new Date(t.dateTirage).toLocaleString('fr-FR'))}</div>
    <div><b>Exemplaires :</b> ${t.nbExemplaires}</div>
    <div><b>Stade :</b> <span class="badge ${t.stade}">${t.stade}</span></div>
    <div style="grid-column: span 2;"><b>Empreinte source (SHA-256) :</b> <code>${echapper(t.empreinteSource)}</code></div>
    ${t.empreinteExemplaires ? `<div style="grid-column: span 2;"><b>Empreintes exemplaires :</b> <code>${echapper(empreinteCourte(t.empreinteExemplaires))}</code></div>` : ''}
  </div>
  <div class="signatures">
    <div class="signature">L'imprimeur<br /><small>${t.imprimeur ? `${echapper(t.imprimeur.prenom)} ${echapper(t.imprimeur.nom)}` : ''}</small></div>
    <div class="signature">Le surveillant<br /><small>${t.examen.surveillant ? `${echapper(t.examen.surveillant.prenom)} ${echapper(t.examen.surveillant.nom)}` : ''}</small></div>
    <div class="signature">Le Chef de département</div>
  </div>
  <footer><span>UniPrésence — sécurité des épreuves</span><span>Édité le ${new Date().toLocaleString('fr-FR')}</span></footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }
}

/** Calcule un SHA-256 stable (hex) à partir d'un contenu ; exporté pour les
 *  seeds / outils de test. La longueur normalisée évite le moindre doute sur
 *  la casse en comparaison. */
export function empreinteSha256(contenu: string | Buffer): string {
  return crypto.createHash('sha256').update(contenu).digest('hex');
}

function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
