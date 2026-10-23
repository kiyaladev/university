/**
 * Module 2 — Gestion des vacataires & paie des heures complémentaires.
 *
 * Les feuil­les de paie mensuelles figent ce que /rapports/etat-paiement
 * calculait à la volée : les heures de service fait CONTROLEES via University
 * sont agrégées en lignes de paie, validées par la direction, marquées payées,
 * puis imprimées en A4. Règle comptable retenue (source de vérité pour les
 * agents comptables — voir `calculer`) :
 *
 *   1. N'entrent dans le décompte que les séances de la période {dateDebut,
 *      dateFin} de la feuille, de statut CONTROLE, dont le contrôle porte l'un
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
 * Une feuille VALIDE ou PAYE est figée : tout recalcul rejette la requête.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutEnseignant, StatutPaie, StatutPresence, StatutSeance } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { AuthUser } from '../../../common/decorators';
import { Paginated } from '../../../common/dto';
import { round2, isoDate } from '../../../common/utils';
import { ParametresService } from '../../socle/parametres/parametres.service';
import { CreateFeuillePaieDto, FeuilleQueryDto } from './paie.dto';
import { paginer, pagine } from '../../../common/pagination';
import { toMontant } from '../../../common/finances/montant';
import { chargerEtablissement, echapper, pageA4, PALETTE_IMPRESSION as P } from '../../../common/impression/index';

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
const STATUTS_PAYES: StatutPresence[] = [StatutPresence.PRESENT, StatutPresence.RETARD, StatutPresence.DEPART_ANTICIPE];

const FEUILLE_INCLUDE = {
  lignes: {
    include: {
      enseignant: {
        select: { id: true, matricule: true, nom: true, prenom: true, statut: true },
      },
    },
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

  async lister(query: FeuilleQueryDto): Promise<Paginated<any>> {
    const pagination = paginer(query);

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
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.feuillePaie.count({ where }),
    ]);

    return pagine(data, total, pagination);
  }

  private async trouver(id: string) {
    const feuille = await this.prisma.feuillePaie.findUnique({
      where: { id },
      include: FEUILLE_INCLUDE,
    });
    if (!feuille) throw new NotFoundException(t('paie.feuille_de_paie_introuvable'));
    return feuille;
  }

  async lire(id: string) {
    return this.trouver(id);
  }

  private instantane(
    feuille: { statut: StatutPaie; montantTotal: Prisma.Decimal | number },
    lignes: Array<{
      enseignantId: string;
      tauxHoraire: Prisma.Decimal | number;
      heuresReelles: number;
      volumePrevu: number;
      montantBrut: Prisma.Decimal | number;
      retenue: Prisma.Decimal | number;
      montantNet: Prisma.Decimal | number;
    }>,
  ) {
    return {
      statut: feuille.statut,
      montantTotal: toMontant(feuille.montantTotal),
      lignes: lignes.map(
        ({ enseignantId, tauxHoraire, heuresReelles, volumePrevu, montantBrut, retenue, montantNet }) => ({
          enseignantId,
          tauxHoraire: toMontant(tauxHoraire),
          heuresReelles,
          volumePrevu,
          montantBrut: toMontant(montantBrut),
          retenue: toMontant(retenue),
          montantNet: toMontant(montantNet),
        }),
      ),
    };
  }

  private enregistrerModification(
    tx: Prisma.TransactionClient,
    userId: string,
    action: string,
    entiteId: string,
    avant: unknown,
    apres: unknown,
  ) {
    return journaliser(tx, { id: userId }, action, 'FeuillePaie', entiteId, { avant, apres });
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
      throw new ConflictException(t('paie.une_feuille_libelle_existe_deja', { libelle: libelle }));
    }

    return this.prisma.$transaction(async (tx) => {
      const feuille = await tx.feuillePaie.create({
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
      await this.enregistrerModification(tx, user.id, 'PAIE_CREEE', feuille.id, null, this.instantane(feuille, []));
      return feuille;
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
        t('paie.feuille_feuille_statut_statutpaie_validee_validee_payee_les_', {
          'feuille.statut': feuille.statut === StatutPaie.VALIDE ? 'validée' : 'payée',
        }),
      );
    }

    const statutEnseignant = tous ? undefined : StatutEnseignant.VACATAIRE;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [seances, affectations] = await Promise.all([
            tx.seance.findMany({
              where: {
                statut: StatutSeance.CONTROLE,
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
            select: {
              enseignantId: true,
              commentaire: true,
              tauxHoraire: true,
              heuresReelles: true,
              volumePrevu: true,
              montantBrut: true,
              retenue: true,
              montantNet: true,
            },
          });
          const commentaires = new Map(
            precedentes.filter((l) => l.commentaire).map((l) => [l.enseignantId, l.commentaire]),
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
          // Le taux horaire est stocké en `numeric(14,2)` : on le ramène à un
          // nombre avant tout calcul, pour que la paie reste arithmétique
          // ordinaire et que l'instantané d'audit porte des nombres.
          const taux = new Map(fiches.map((e) => [e.id, toMontant(e.tauxHoraire)]));

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

          const ecriture = await tx.feuillePaie.updateMany({
            where: { id: feuille.id, statut: StatutPaie.BROUILLON, updatedAt: feuille.updatedAt },
            data: { montantTotal: round2(lignes.reduce((t, l) => t + l.montantNet, 0)) },
          });
          if (ecriture.count !== 1) {
            throw new ConflictException(t('paie.ecriture_concurrente_reessayez'));
          }
          const miseAJour = await tx.feuillePaie.findUnique({ where: { id: feuille.id }, include: FEUILLE_INCLUDE });
          if (!miseAJour) throw new NotFoundException(t('paie.feuille_de_paie_introuvable'));
          await this.enregistrerModification(
            tx,
            user.id,
            'PAIE_RECALCULEE',
            feuille.id,
            this.instantane(feuille, precedentes),
            this.instantane(miseAJour, lignes),
          );
          return miseAJour;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException(t('paie.ecriture_concurrente_reessayez'));
      }
      throw error;
    }
  }

  /** BROUILLON → VALIDE : les montants sont figés, plus aucun recalcul. */
  async valider(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const feuille = await tx.feuillePaie.findUnique({ where: { id }, include: FEUILLE_INCLUDE });
      if (!feuille) throw new NotFoundException(t('paie.feuille_de_paie_introuvable'));
      if (feuille.statut !== StatutPaie.BROUILLON) {
        throw new BadRequestException(t('paie.seule_une_feuille_en_brouillon_peut_etre_validee'));
      }
      if (!feuille.lignes.length) {
        throw new BadRequestException(t('paie.calculez_la_feuille_avant_de_la_valider'));
      }
      const ecriture = await tx.feuillePaie.updateMany({
        where: { id, statut: StatutPaie.BROUILLON, updatedAt: feuille.updatedAt },
        data: {
          statut: StatutPaie.VALIDE,
          valideeParId: user.id,
          valideeLe: new Date(),
        },
      });
      if (ecriture.count !== 1) throw new ConflictException(t('paie.ecriture_concurrente_reessayez'));
      const miseAJour = await tx.feuillePaie.findUnique({ where: { id }, include: FEUILLE_INCLUDE });
      if (!miseAJour) throw new NotFoundException(t('paie.feuille_de_paie_introuvable'));
      await this.enregistrerModification(
        tx,
        user.id,
        'PAIE_VALIDEE',
        id,
        this.instantane(feuille, feuille.lignes),
        this.instantane(miseAJour, miseAJour.lignes),
      );
      return miseAJour;
    });
  }

  /** VALIDE → PAYE : le mandat est exécuté, trace du paiement. */
  async payer(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const feuille = await tx.feuillePaie.findUnique({ where: { id }, include: FEUILLE_INCLUDE });
      if (!feuille) throw new NotFoundException(t('paie.feuille_de_paie_introuvable'));
      if (feuille.statut !== StatutPaie.VALIDE) {
        throw new BadRequestException(t('paie.seule_une_feuille_validee_peut_etre_payee'));
      }
      const ecriture = await tx.feuillePaie.updateMany({
        where: { id, statut: StatutPaie.VALIDE, updatedAt: feuille.updatedAt },
        data: { statut: StatutPaie.PAYE, payeeLe: new Date() },
      });
      if (ecriture.count !== 1) throw new ConflictException(t('paie.ecriture_concurrente_reessayez'));
      const miseAJour = await tx.feuillePaie.findUnique({ where: { id }, include: FEUILLE_INCLUDE });
      if (!miseAJour) throw new NotFoundException(t('paie.feuille_de_paie_introuvable'));
      await this.enregistrerModification(
        tx,
        user.id,
        'PAIE_PAYEE',
        id,
        this.instantane(feuille, feuille.lignes),
        this.instantane(miseAJour, miseAJour.lignes),
      );
      return miseAJour;
    });
  }

  /** Suppression : réservée à l'administration, sur une feuille non figée. */
  async supprimer(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const feuille = await tx.feuillePaie.findUnique({ where: { id }, include: FEUILLE_INCLUDE });
      if (!feuille) throw new NotFoundException(t('paie.feuille_de_paie_introuvable'));
      if (feuille.statut !== StatutPaie.BROUILLON) {
        throw new BadRequestException(t('paie.seule_une_feuille_en_brouillon_peut_etre_supprimee'));
      }
      const suppression = await tx.feuillePaie.deleteMany({
        where: { id, statut: StatutPaie.BROUILLON, updatedAt: feuille.updatedAt },
      });
      if (suppression.count !== 1) throw new ConflictException(t('paie.ecriture_concurrente_reessayez'));
      await this.enregistrerModification(
        tx,
        user.id,
        'PAIE_SUPPRIMEE',
        id,
        this.instantane(feuille, feuille.lignes),
        null,
      );
      return { id };
    });
  }

  // ---------------------------------------------------------- impression

  async imprimer(id: string): Promise<string> {
    const feuille = await this.trouver(id);
    const etablissement = await chargerEtablissement(this.prisma);
    const edite = new Date().toLocaleString('fr-FR');

    const lignesHtml = feuille.lignes
      .map(
        (l) => `<tr>
        <td>${echapper(l.enseignant.nom)} ${echapper(l.enseignant.prenom)}<br>
            <small>${echapper(l.enseignant.matricule)}</small></td>
        <td class="num">${toMontant(l.tauxHoraire).toLocaleString('fr-FR')}</td>
        <td class="num">${l.heuresReelles} h</td>
        <td class="num">${l.volumePrevu} h</td>
        <td class="num">${toMontant(l.montantBrut).toLocaleString('fr-FR')}</td>
        <td class="num">${toMontant(l.retenue).toLocaleString('fr-FR')}</td>
        <td class="num">${toMontant(l.montantNet).toLocaleString('fr-FR')}</td>
        <td>${l.commentaire ? echapper(l.commentaire) : ''}</td>
      </tr>`,
      )
      .join('');

    return pageA4({
      titre: `Feuille de paie — ${feuille.libelle}`,
      lang: 'fr',
      etablissement,
      styles: STYLE_FEUILLE_PAIE,
      entete: `<div class="etab">${echapper(etablissement.nom)}</div>
    <div class="titre">Feuille de paie — ${echapper(feuille.libelle)}</div>
    <div class="sous-titre">Heures des vacataires contrôlées dans University</div>`,
      corps: `<div class="meta">
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
    <tbody>${lignesHtml || `<tr><td colspan="8" style="color:${P.encreDouce}">Aucune ligne — feuille non calculée</td></tr>`}</tbody>
    <tfoot><tr>
      <td colspan="6">Montant total à payer</td>
      <td class="num">${toMontant(feuille.montantTotal).toLocaleString('fr-FR')}</td>
      <td></td>
    </tr></tfoot>
  </table>
  <div class="signatures">
    <div class="signature">Le Comptable</div>
    <div class="signature">Le DAF</div>
    <div class="signature">Le Recteur</div>
  </div>`,
      piedDePage: `<span>University — feuille de paie mensuelle des vacataires</span><span>Édité le ${edite}</span>`,
    });
  }
}

const LIBELLE_STATUT_PAIE: Record<string, string> = {
  BROUILLON: 'Brouillon',
  VALIDE: 'Validé',
  PAYE: 'Payé',
};

/** Règles propres à la feuille de paie ; le reste vient de `pageA4`. */
const STYLE_FEUILLE_PAIE = `
  .badge { padding: 2px 8px; font-weight: 700; text-transform: uppercase; }
  .BROUILLON { background: ${P.grisInerte}; color: ${P.encreDouce}; }
  .VALIDE, .PAYE { background: ${P.vertFond}; color: ${P.vert}; }
  tfoot td { font-weight: 700; background: ${P.grisFond}; }
  .signatures { margin-top: 42px; }
`;
