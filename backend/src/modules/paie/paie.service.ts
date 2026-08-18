/**
 * Module 2 — Gestion des vacataires & paie des heures complémentaires.
 *
 * Les feuil­les de paie mensuelles figent ce que /rapports/etat-paiement
 * calculait à la volée : les heures de service fait CONTROLEES via UniPrésence
 * sont agrégées en lignes de paie, validées par la direction, marquées payées,
 * puis imprimées en A4. Règle comptable retenue (source de vérité pour les
 * agents comptables — voir `calculer`) :
 *
 *   1. N'entrent dans le décompte que les séances de la période {dateDebut,
 *      dateFin} de la feuille, de statut CONTROLEE, dont le contrôle porte l'un
 *      des statuts PRESENT, RETARD, DEPART_ANTICIPE : l'enseignant a tenu sa
 *      séance, même en retard ou en départ anticipé. Les séances ABSENT,
 *      EXCUSE et REMPLACE ne sont jamais rémunérées sur cette feuille (la
 *      remise du remplaçant ne se règle pas au titulaire).
 *   2. Les minutes de toutes ces séances s'additionnent ; l'heure n'est comptée
 *      qu'entamée la pleine : heuresReelles = arrondi inférieur du total en
 *      minutes / 60 (aucune majoration, aucun quart d'heure silencieux —
 *      toute minute contrôlée compte dans le total, mais seules les heures
 *      complètes sont payées).
 *   3. volumePrevu = somme des heures contractuelles (volumeHorairePrevu) des
 *      affectations de l'enseignant dont l'année académique recouvre la période
 *      de la feuille. tauxHoraire = taux en vigueur sur la fiche au moment du
 *      calcul (instantané figé à la ligne). montantBrut = heuresReelles ×
 *      tauxHoraire ; retenue = 0 par défaut ; montantNet = brut − retenue.
 *   4. Le recalcul efface les lignes puis les recrée dans la même transaction ;
 *      le commentaire porté sur une ligne existante est conservé. Le
 *      montantTotal de la feuille est la somme des montants nets.
 *
 * Une feuille VALIDEE ou PAYEE est figée : tout recalcul rejette la requête.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StatutEnseignant,
  StatutPaie,
  StatutPresence,
  StatutSeance,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated } from '../../common/dto';
import { round2, isoDate } from '../../common/utils';
import { ParametresService } from '../parametres/parametres.module';
import { CreateFeuillePaieDto, FeuilleQueryDto } from './paie.dto';

/** « Janvier 2026 » — les mois sont écrits en toutes lettres sur les états. */
export const MOIS_LIBELLES = [
  '',
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

/** Statuts de contrôle qui font « service fait » et donc heures payables. */
const STATUTS_PAYES: StatutPresence[] = [
  StatutPresence.PRESENT,
  StatutPresence.RETARD,
  StatutPresence.DEPART_ANTICIPE,
];

const FEUILLE_INCLUDE = {
  lignes: {
    include: { enseignant: true },
    orderBy: [{ enseignant: { nom: 'asc' } }, { enseignant: { prenom: 'asc' } }],
  },
} satisfies Prisma.FeuillePaieInclude;

@Injectable()
export class PaieService {
  constructor(
    private prisma: PrismaService,
    private parametres: ParametresService,
  ) {}

  // ---------------------------------------------------------------- lecture

  async liste(query: FeuilleQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.FeuillePaieWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.annee ? { annee: query.annee } : {}),
      ...(query.mois ? { mois: query.mois } : {}),
      // `FeuilleQueryDto` hérite de `QueryDto` et expose donc `search` : le
      // seul texte d'une feuille est son libellé (« Janvier 2026 »).
      ...(query.search ? { libelle: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.feuillePaie.findMany({
        where,
        include: FEUILLE_INCLUDE,
        orderBy: [{ annee: 'desc' }, { mois: 'desc' }],
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.feuillePaie.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  private async trouver(id: string) {
    const feuille = await this.prisma.feuillePaie.findUnique({
      where: { id },
      include: FEUILLE_INCLUDE,
    });
    if (!feuille) throw new NotFoundException('Feuille de paie introuvable');
    return feuille;
  }

  async detail(id: string) {
    return this.trouver(id);
  }

  // ----------------------------------------------------- cycle de vie

  /** Création manuelle : mois + année → « Janvier 2026 », 1er … fin de mois. */
  async creer(dto: CreateFeuillePaieDto, user: AuthUser) {
    const libelle = `${MOIS_LIBELLES[dto.mois]} ${dto.annee}`;
    const existe = await this.prisma.feuillePaie.findUnique({
      where: { libelle },
      select: { id: true },
    });
    if (existe) {
      throw new ConflictException(`Une feuille « ${libelle} » existe déjà`);
    }

    return this.prisma.feuillePaie.create({
      data: {
        libelle,
        mois: dto.mois,
        annee: dto.annee,
        dateDebut: new Date(Date.UTC(dto.annee, dto.mois - 1, 1)),
        dateFin: new Date(Date.UTC(dto.annee, dto.mois, 0)),
        creeParId: user.id,
      },
      include: FEUILLE_INCLUDE,
    });
  }

  /**
   * Le cœur du module : recalcule les lignes de la période, en une seule
   * transaction. Lignes existantes supprimées puis recréées — le commentaire
   * éventuel d'une ligne est conservé. Voir la règle comptable en tête de
   * fichier pour le détail de l'agrégation.
   */
  async calculer(id: string, tous: boolean, user: AuthUser) {
    const feuille = await this.trouver(id);
    if (feuille.statut !== StatutPaie.BROUILLON) {
      throw new BadRequestException(
        `Feuille ${feuille.statut === StatutPaie.VALIDEE ? 'validée' : 'payée'} : les montants sont figés, impossible de recalculer`,
      );
    }

    const statutEnseignant = tous ? undefined : StatutEnseignant.VACATAIRE;

    return this.prisma.$transaction(async (tx) => {
      const [seances, affectations] = await Promise.all([
        tx.seance.findMany({
          where: {
            statut: StatutSeance.CONTROLEE,
            date: { gte: feuille.dateDebut, lte: feuille.dateFin },
            controle: { is: { statut: { in: STATUTS_PAYES } } },
            affectation: { enseignant: statutEnseignant ? { statut: statutEnseignant } : {} },
          },
          select: {
            controle: { select: { dureeMinutes: true } },
            affectation: { select: { enseignantId: true } },
          },
        }),
        // Affectations « de la période » : l'année académique qui les porte
        // recouvre la période de la feuille (début ≤ fin de feuille et
        // fin ≥ début de feuille). Les heures contractuelles de l'année sont
        // proratées nulle part : le volume est un repère, pas une limite.
        tx.affectation.findMany({
          where: {
            ...(statutEnseignant ? { enseignant: { statut: statutEnseignant } } : {}),
            annee: {
              dateDebut: { lte: feuille.dateFin },
              dateFin: { gte: feuille.dateDebut },
            },
          },
          select: { enseignantId: true, volumeHorairePrevu: true },
        }),
      ]);

      // Commentaires des lignes existantes : la loi du module, une ligne avec
      // un commentaire (restitution, congé exceptionnel…) garde son texte lors
      // d'un nouveau calcul.
      const precedentes = await tx.lignePaie.findMany({
        where: { feuilleId: id },
        select: { enseignantId: true, commentaire: true },
      });
      const commentaires = new Map(
        precedentes
          .filter((l) => l.commentaire)
          .map((l) => [l.enseignantId, l.commentaire]),
      );

      // Agrégation minute par minute, par enseignant.
      const minutes = new Map<string, number>();
      for (const s of seances) {
        const minutesEnseignant = minutes.get(s.affectation.enseignantId) ?? 0;
        // Le filtre `controle: { is: { statut: { in: STATUTS_PAYES } } }` garantit
        // un contrôle présent ; ?? 0 défensive pour la sûreté du typage.
        minutes.set(s.affectation.enseignantId, minutesEnseignant + (s.controle?.dureeMinutes ?? 0));
      }
      const volume = new Map<string, number>();
      for (const a of affectations) {
        volume.set(a.enseignantId, (volume.get(a.enseignantId) ?? 0) + a.volumeHorairePrevu);
      }

      const enseignantsId = [...minutes.keys()];
      const fiches = enseignantsId.length
        ? await tx.enseignant.findMany({
            where: { id: { in: enseignantsId } },
            select: { id: true, tauxHoraire: true },
          })
        : [];
      const taux = new Map(fiches.map((e) => [e.id, e.tauxHoraire]));

      const lignes = enseignantsId.map((enseignantId) => {
        const heuresReelles = Math.floor(minutes.get(enseignantId)! / 60);
        const tauxHoraire = taux.get(enseignantId) ?? 0;
        const montantBrut = round2(heuresReelles * tauxHoraire);
        return {
          enseignantId,
          tauxHoraire,
          heuresReelles,
          volumePrevu: volume.get(enseignantId) ?? 0,
          montantBrut,
          retenue: 0,
          montantNet: montantBrut,
          commentaire: commentaires.get(enseignantId) ?? null,
        };
      });

      await tx.lignePaie.deleteMany({ where: { feuilleId: feuille.id } });
      if (lignes.length) {
        await tx.lignePaie.createMany({
          data: lignes.map((l) => ({ feuilleId: feuille.id, ...l })),
        });
      }

      return tx.feuillePaie.update({
        where: { id: feuille.id },
        data: { montantTotal: round2(lignes.reduce((t, l) => t + l.montantNet, 0)) },
        include: FEUILLE_INCLUDE,
      });
    });
  }

  /** BROUILLON → VALIDEE : les montants sont figés, plus aucun recalcul. */
  async valider(id: string, user: AuthUser) {
    const feuille = await this.trouver(id);
    if (feuille.statut !== StatutPaie.BROUILLON) {
      throw new BadRequestException('Seule une feuille en brouillon peut être validée');
    }
    if (!feuille.lignes.length) {
      throw new BadRequestException('Calculez la feuille avant de la valider');
    }
    return this.prisma.feuillePaie.update({
      where: { id },
      data: {
        statut: StatutPaie.VALIDEE,
        valideeParId: user.id,
        valideeLe: new Date(),
      },
      include: FEUILLE_INCLUDE,
    });
  }

  /** VALIDEE → PAYEE : le mandat est exécuté, trace du paiement. */
  async payer(id: string, user: AuthUser) {
    const feuille = await this.trouver(id);
    if (feuille.statut !== StatutPaie.VALIDEE) {
      throw new BadRequestException('Seule une feuille validée peut être payée');
    }
    return this.prisma.feuillePaie.update({
      where: { id },
      data: { statut: StatutPaie.PAYEE, payeeLe: new Date() },
      include: FEUILLE_INCLUDE,
    });
  }

  /** Suppression : réservée à l'administration, sur une feuille non figée. */
  async supprimer(id: string) {
    const feuille = await this.trouver(id);
    if (feuille.statut !== StatutPaie.BROUILLON) {
      throw new BadRequestException('Seule une feuille en brouillon peut être supprimée');
    }
    await this.prisma.feuillePaie.delete({ where: { id } });
    return { id };
  }

  // ---------------------------------------------------------- impression

  async imprimer(id: string): Promise<string> {
    const feuille = await this.trouver(id);
    const etablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');
    const edite = new Date().toLocaleString('fr-FR');

    const lignesHtml = feuille.lignes
      .map((l) => `<tr>
        <td>${echapper(l.enseignant.nom)} ${echapper(l.enseignant.prenom)}<br>
            <small>${echapper(l.enseignant.matricule)}</small></td>
        <td class="num">${l.tauxHoraire.toLocaleString('fr-FR')}</td>
        <td class="num">${l.heuresReelles} h</td>
        <td class="num">${l.volumePrevu} h</td>
        <td class="num">${l.montantBrut.toLocaleString('fr-FR')}</td>
        <td class="num">${l.retenue.toLocaleString('fr-FR')}</td>
        <td class="num">${l.montantNet.toLocaleString('fr-FR')}</td>
        <td>${l.commentaire ? echapper(l.commentaire) : ''}</td>
      </tr>`)
      .join('');

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Feuille de paie — ${echapper(feuille.libelle)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm 12mm; font-size: 12px; }
  header { border-bottom: 2px solid #1565c0; padding-bottom: 8px; margin-bottom: 14px; }
  .etab { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .titre { font-size: 19px; font-weight: 700; margin-top: 6px; color: #0d47a1; }
  .sous-titre { color: #555; margin-top: 2px; }
  .meta { display: flex; gap: 18px; margin: 12px 0 4px; font-size: 11px; color: #444; }
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .BROUILLON { background: #eceeef; color: #5b6570; }
  .VALIDEE { background: #e3f5e9; color: #17683a; }
  .PAYEE { background: #e3ecf7; color: #15518f; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #b9c4cf; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #e8eef5; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
  .num { text-align: right; }
  tbody tr:nth-child(even) { background: #fafbfd; }
  tfoot td { font-weight: 700; background: #e8eef5; }
  .signatures { display: flex; justify-content: space-between; margin-top: 42px; }
  .signature { width: 30%; border-top: 1px solid #999; padding-top: 4px; text-align: center; color: #555; }
  footer { margin-top: 18px; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
  @media print { body { padding: 8mm; } }
  @page { size: A4; margin: 10mm; }
</style></head>
<body>
  <header>
    <div class="etab">${echapper(etablissement)}</div>
    <div class="titre">Feuille de paie — ${echapper(feuille.libelle)}</div>
    <div class="sous-titre">Heures des vacataires contrôlées par UniPrésence</div>
  </header>
  <div class="meta">
    <span>Période : du ${echapper(isoDate(feuille.dateDebut))} au ${echapper(isoDate(feuille.dateFin))}</span>
    <span>Statut : <span class="badge ${feuille.statut}">${LIBELLE_STATUT_PAIE[feuille.statut]}</span></span>
    ${feuille.valideeLe ? `<span>Validée le ${echapper(feuille.valideeLe)}</span>` : ''}
    ${feuille.payeeLe ? `<span>Payée le ${echapper(feuille.payeeLe)}</span>` : ''}
  </div>
  <table>
    <thead><tr>
      <th>Enseignant</th><th>Taux horaire</th><th>Heures réalisées</th>
      <th>Volume prévu</th><th>Brut</th><th>Retenue</th><th>Net</th><th>Commentaire</th>
    </tr></thead>
    <tbody>${lignesHtml || '<tr><td colspan="8" style="color:#777">Aucune ligne — feuille non calculée</td></tr>'}</tbody>
    <tfoot><tr>
      <td colspan="6">Montant total à payer</td>
      <td class="num">${feuille.montantTotal.toLocaleString('fr-FR')}</td>
      <td></td>
    </tr></tfoot>
  </table>
  <div class="signatures">
    <div class="signature">Le Comptable</div>
    <div class="signature">Le DAF</div>
    <div class="signature">Le Recteur</div>
  </div>
  <footer><span>UniPrésence — feuille de paie mensuelle des vacataires</span><span>Édité le ${edite}</span></footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }
}

const LIBELLE_STATUT_PAIE: Record<string, string> = {
  BROUILLON: 'Brouillon',
  VALIDEE: 'Validée',
  PAYEE: 'Payée',
};

function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}