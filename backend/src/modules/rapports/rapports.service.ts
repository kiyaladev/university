/** Exploitation statistique du contrôle : tableaux de bord, taux d'assiduité,
 *  suivi du volume horaire réalisé et état de paiement des vacataires. */
import { Injectable } from '@nestjs/common';
import { Prisma, StatutPresence, StatutSeance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { dureeMinutes, isoDate, pct, round2, toDateOnly } from '../../common/utils';
import { RapportQueryDto } from './rapports.dto';

type SeanceComplete = Prisma.SeanceGetPayload<{
  include: {
    controle: true;
    salle: true;
    justificatif: true;
    affectation: {
      include: {
        enseignant: { include: { departement: true } };
        matiere: true;
        promotion: { include: { filiere: true } };
      };
    };
  };
}>;

const SEANCE_STATS_INCLUDE = {
  controle: true,
  salle: true,
  justificatif: true,
  affectation: {
    include: {
      enseignant: { include: { departement: true } },
      matiere: true,
      promotion: { include: { filiere: true } },
    },
  },
} satisfies Prisma.SeanceInclude;

interface Compteurs {
  planifiees: number;
  controlees: number;
  present: number;
  retard: number;
  absent: number;
  excuse: number;
  remplace: number;
  departAnticipe: number;
  minutesPrevues: number;
  minutesRealisees: number;
}

const nouveauxCompteurs = (): Compteurs => ({
  planifiees: 0,
  controlees: 0,
  present: 0,
  retard: 0,
  absent: 0,
  excuse: 0,
  remplace: 0,
  departAnticipe: 0,
  minutesPrevues: 0,
  minutesRealisees: 0,
});

function cumuler(c: Compteurs, s: SeanceComplete) {
  c.planifiees += 1;
  c.minutesPrevues += dureeMinutes(s.heureDebut, s.heureFin);
  if (!s.controle) return;

  c.controlees += 1;
  c.minutesRealisees += s.controle.dureeMinutes;
  switch (s.controle.statut) {
    case StatutPresence.PRESENT:
      c.present += 1;
      break;
    case StatutPresence.RETARD:
      c.retard += 1;
      break;
    case StatutPresence.ABSENT:
      c.absent += 1;
      break;
    case StatutPresence.EXCUSE:
      c.excuse += 1;
      break;
    case StatutPresence.REMPLACE:
      c.remplace += 1;
      break;
    case StatutPresence.DEPART_ANTICIPE:
      c.departAnticipe += 1;
      break;
  }
}

/** Séances effectivement assurées (présence, retard, départ anticipé, remplacement). */
const assurees = (c: Compteurs) => c.present + c.retard + c.departAnticipe + c.remplace;

function synthese(c: Compteurs) {
  return {
    ...c,
    heuresPrevues: round2(c.minutesPrevues / 60),
    heuresRealisees: round2(c.minutesRealisees / 60),
    assurees: assurees(c),
    /** Part des séances assurées parmi les séances contrôlées. */
    tauxPresence: pct(assurees(c), c.controlees),
    /** Part des séances effectivement contrôlées (couverture du dispositif). */
    tauxControle: pct(c.controlees, c.planifiees),
    /** Heures réalisées rapportées aux heures programmées. */
    tauxRealisation: pct(c.minutesRealisees, c.minutesPrevues),
  };
}

@Injectable()
export class RapportsService {
  constructor(private prisma: PrismaService) {}

  private where(query: RapportQueryDto, user?: AuthUser): Prisma.SeanceWhereInput {
    const date: Prisma.DateTimeFilter = {};
    if (query.dateDebut) date.gte = toDateOnly(query.dateDebut);
    if (query.dateFin) date.lte = toDateOnly(query.dateFin);

    const affectation: Record<string, any> = {};
    if (query.anneeId) affectation.anneeId = query.anneeId;
    if (query.enseignantId) affectation.enseignantId = query.enseignantId;
    if (query.promotionId) affectation.promotionId = query.promotionId;

    const departementId = query.departementId ?? undefined;
    if (departementId) affectation.enseignant = { departementId };

    return {
      statut: { not: StatutSeance.ANNULEE },
      ...(Object.keys(date).length ? { date } : {}),
      ...(Object.keys(affectation).length ? { affectation } : {}),
      ...(query.salleId ? { salleId: query.salleId } : {}),
    };
  }

  private seances(query: RapportQueryDto, user?: AuthUser) {
    return this.prisma.seance.findMany({
      where: this.where(query, user),
      include: SEANCE_STATS_INCLUDE,
      orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
    }) as Promise<SeanceComplete[]>;
  }

  // ------------------------------------------------------------- tableau de bord

  async dashboard(query: RapportQueryDto) {
    const aujourdhui = isoDate(new Date());
    const debutPeriode =
      query.dateDebut ?? isoDate(new Date(Date.now() - 29 * 86400000));
    const finPeriode = query.dateFin ?? aujourdhui;

    const [seancesPeriode, seancesJour, justificatifsEnAttente] = await Promise.all([
      this.seances({ ...query, dateDebut: debutPeriode, dateFin: finPeriode }),
      this.seances({ ...query, dateDebut: aujourdhui, dateFin: aujourdhui }),
      this.prisma.justificatif.count({ where: { statut: 'EN_ATTENTE' } }),
    ]);

    const global = nouveauxCompteurs();
    seancesPeriode.forEach((s) => cumuler(global, s));
    const jour = nouveauxCompteurs();
    seancesJour.forEach((s) => cumuler(jour, s));

    // Évolution sur les 14 derniers jours
    const evolution: Array<Record<string, any>> = [];
    for (let i = 13; i >= 0; i--) {
      const d = isoDate(new Date(Date.now() - i * 86400000));
      const c = nouveauxCompteurs();
      seancesPeriode.filter((s) => isoDate(s.date) === d).forEach((s) => cumuler(c, s));
      evolution.push({
        date: d,
        planifiees: c.planifiees,
        assurees: assurees(c),
        absences: c.absent,
        retards: c.retard,
        tauxPresence: pct(assurees(c), c.controlees),
      });
    }

    // Classement des départements
    const parDepartement = new Map<string, { nom: string; c: Compteurs }>();
    for (const s of seancesPeriode) {
      const dep = s.affectation.enseignant.departement;
      const cle = dep?.id ?? 'sans';
      if (!parDepartement.has(cle)) {
        parDepartement.set(cle, { nom: dep?.nom ?? 'Sans département', c: nouveauxCompteurs() });
      }
      cumuler(parDepartement.get(cle)!.c, s);
    }

    // Enseignants les plus absents
    const parEnseignant = new Map<string, { nom: string; c: Compteurs }>();
    for (const s of seancesPeriode) {
      const e = s.affectation.enseignant;
      if (!parEnseignant.has(e.id)) {
        parEnseignant.set(e.id, { nom: `${e.nom} ${e.prenom}`, c: nouveauxCompteurs() });
      }
      cumuler(parEnseignant.get(e.id)!.c, s);
    }

    return {
      periode: { debut: debutPeriode, fin: finPeriode },
      jour: { date: aujourdhui, ...synthese(jour), enAttente: jour.planifiees - jour.controlees },
      global: synthese(global),
      justificatifsEnAttente,
      evolution,
      departements: [...parDepartement.entries()]
        .map(([id, v]) => ({ id, nom: v.nom, ...synthese(v.c) }))
        .sort((a, b) => b.tauxPresence - a.tauxPresence),
      enseignantsAbsents: [...parEnseignant.entries()]
        .map(([id, v]) => ({ id, nom: v.nom, ...synthese(v.c) }))
        .filter((e) => e.absent > 0)
        .sort((a, b) => b.absent - a.absent)
        .slice(0, 10),
      // Clés d'énumération et non libellés : le serveur ne traduit pas. Les
      // libellés vivaient ici en double des libellés du client et avaient déjà
      // divergé (« Excusé » ici, « Absence excusée » à l'écran).
      repartition: [
        { statut: 'PRESENT', valeur: global.present },
        { statut: 'RETARD', valeur: global.retard },
        { statut: 'ABSENT', valeur: global.absent },
        { statut: 'EXCUSE', valeur: global.excuse },
        { statut: 'REMPLACE', valeur: global.remplace },
        { statut: 'DEPART_ANTICIPE', valeur: global.departAnticipe },
        { statut: 'NON_CONTROLE', valeur: global.planifiees - global.controlees },
      ],
    };
  }

  // ------------------------------------------------------- assiduité enseignants

  async presenceEnseignants(query: RapportQueryDto) {
    const seances = await this.seances(query);
    const map = new Map<string, { enseignant: any; c: Compteurs }>();

    for (const s of seances) {
      const e = s.affectation.enseignant;
      if (!map.has(e.id)) map.set(e.id, { enseignant: e, c: nouveauxCompteurs() });
      cumuler(map.get(e.id)!.c, s);
    }

    const lignes = [...map.values()]
      .map(({ enseignant, c }) => ({
        enseignantId: enseignant.id,
        matricule: enseignant.matricule,
        nom: `${enseignant.nom} ${enseignant.prenom}`,
        grade: enseignant.grade,
        statutEnseignant: enseignant.statut,
        departement: enseignant.departement?.nom ?? null,
        ...synthese(c),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom));

    const total = nouveauxCompteurs();
    seances.forEach((s) => cumuler(total, s));

    return { periode: { debut: query.dateDebut, fin: query.dateFin }, total: synthese(total), lignes };
  }

  // ------------------------------------------------------------ volume horaire

  async volumeHoraire(query: RapportQueryDto) {
    const seances = await this.seances(query);
    const map = new Map<string, { aff: any; c: Compteurs }>();

    for (const s of seances) {
      const a = s.affectation;
      if (!map.has(a.id)) map.set(a.id, { aff: a, c: nouveauxCompteurs() });
      cumuler(map.get(a.id)!.c, s);
    }

    const lignes = [...map.values()].map(({ aff, c }) => {
      const s = synthese(c);
      return {
        affectationId: aff.id,
        enseignant: `${aff.enseignant.nom} ${aff.enseignant.prenom}`,
        departement: aff.enseignant.departement?.nom ?? null,
        matiere: aff.matiere.intitule,
        codeMatiere: aff.matiere.code,
        promotion: aff.promotion.nom,
        volumeHorairePrevu: aff.volumeHorairePrevu,
        ...s,
        reste: round2(Math.max(0, aff.volumeHorairePrevu - s.heuresRealisees)),
        tauxContrat: pct(s.heuresRealisees, aff.volumeHorairePrevu),
      };
    });

    return { lignes: lignes.sort((a, b) => a.enseignant.localeCompare(b.enseignant)) };
  }

  // ------------------------------------------------- état de paiement (vacataires)

  async etatPaiement(query: RapportQueryDto) {
    const seances = await this.seances(query);
    const map = new Map<string, { enseignant: any; c: Compteurs; detail: Map<string, Compteurs> }>();

    for (const s of seances) {
      const e = s.affectation.enseignant;
      if (query.statutEnseignant && e.statut !== query.statutEnseignant) continue;
      if (!map.has(e.id)) {
        map.set(e.id, { enseignant: e, c: nouveauxCompteurs(), detail: new Map() });
      }
      const entree = map.get(e.id)!;
      cumuler(entree.c, s);

      const cle = `${s.affectation.matiere.intitule} — ${s.affectation.promotion.nom}`;
      if (!entree.detail.has(cle)) entree.detail.set(cle, nouveauxCompteurs());
      cumuler(entree.detail.get(cle)!, s);
    }

    const lignes = [...map.values()].map(({ enseignant, c, detail }) => {
      const s = synthese(c);
      return {
        enseignantId: enseignant.id,
        matricule: enseignant.matricule,
        nom: `${enseignant.nom} ${enseignant.prenom}`,
        statutEnseignant: enseignant.statut,
        departement: enseignant.departement?.nom ?? null,
        tauxHoraire: enseignant.tauxHoraire,
        heuresRealisees: s.heuresRealisees,
        montant: round2(s.heuresRealisees * enseignant.tauxHoraire),
        seancesAssurees: s.assurees,
        absences: c.absent,
        detail: [...detail.entries()].map(([libelle, d]) => ({
          libelle,
          heures: round2(d.minutesRealisees / 60),
          seances: assurees(d),
        })),
      };
    });

    return {
      periode: { debut: query.dateDebut, fin: query.dateFin },
      totalMontant: round2(lignes.reduce((t, l) => t + l.montant, 0)),
      totalHeures: round2(lignes.reduce((t, l) => t + l.heuresRealisees, 0)),
      lignes: lignes.sort((a, b) => b.montant - a.montant),
    };
  }

  // ------------------------------------------------------------- par salle

  /**
   * Ce que le contrôleur veut savoir de son terrain : quelles salles il visite,
   * lesquelles lui échappent, et lesquelles concentrent les absences.
   */
  async parSalle(query: RapportQueryDto) {
    const seances = await this.seances(query);
    const map = new Map<string, { salle: any; c: Compteurs; derniereVisite: Date | null }>();

    for (const s of seances) {
      const cle = s.salle?.id ?? 'sans';
      if (!map.has(cle)) {
        map.set(cle, {
          salle: s.salle ?? { id: null, code: '—', nom: 'Sans salle affectée', capacite: 0 },
          c: nouveauxCompteurs(),
          derniereVisite: null,
        });
      }
      const entree = map.get(cle)!;
      cumuler(entree.c, s);

      if (s.controle && (!entree.derniereVisite || s.date > entree.derniereVisite)) {
        entree.derniereVisite = s.date;
      }
    }

    const lignes = [...map.values()].map(({ salle, c, derniereVisite }) => {
      const s = synthese(c);
      return {
        salleId: salle.id,
        code: salle.code,
        nom: salle.nom,
        batiment: salle.batiment ?? null,
        capacite: salle.capacite ?? 0,
        derniereVisite: derniereVisite ? isoDate(derniereVisite) : null,
        // Occupation : ce que la salle a réellement servi, rapporté au programmé.
        tauxOccupation: s.tauxRealisation,
        effectifMoyen: c.controlees
          ? Math.round(
              seances
                .filter((x) => (x.salle?.id ?? 'sans') === (salle.id ?? 'sans'))
                .reduce((t, x) => t + (x.controle?.effectifPresent ?? 0), 0) / c.controlees,
            )
          : 0,
        ...s,
      };
    });

    const total = nouveauxCompteurs();
    seances.forEach((x) => cumuler(total, x));

    return {
      periode: { debut: query.dateDebut, fin: query.dateFin },
      total: synthese(total),
      lignes: lignes.sort((a, b) => a.code.localeCompare(b.code)),
    };
  }

  // ------------------------------------------------------------------ registre

  /** Registre de contrôle : la transcription fidèle du cahier du contrôleur. */
  async registre(query: RapportQueryDto) {
    const jour = query.date ?? query.dateDebut ?? isoDate(new Date());
    const seances = await this.seances({ ...query, dateDebut: jour, dateFin: query.dateFin ?? jour });

    const lignes = seances.map((s) => ({
      seanceId: s.id,
      date: isoDate(s.date),
      horaire: `${s.heureDebut} - ${s.heureFin}`,
      enseignant: `${s.affectation.enseignant.nom} ${s.affectation.enseignant.prenom}`,
      matricule: s.affectation.enseignant.matricule,
      matiere: s.affectation.matiere.intitule,
      promotion: s.affectation.promotion.nom,
      salle: s.salle?.code ?? '—',
      type: s.type,
      statut: s.controle?.statut ?? 'NON_CONTROLE',
      heureArrivee: s.controle?.heureArrivee ?? '—',
      heureFinReelle: s.controle?.heureFinReelle ?? '—',
      dureeMinutes: s.controle?.dureeMinutes ?? 0,
      effectifPresent: s.controle?.effectifPresent ?? null,
      thematiqueTraitee: s.controle?.thematiqueTraitee ?? s.thematique ?? '',
      observation: s.controle?.observation ?? '',
      methode: s.controle?.methode ?? null,
      attestation: s.controle?.attestation ?? null,
      attestationValide: s.controle?.attestationValide ?? false,
      signatureBase64: s.controle?.signatureBase64 ?? null,
      justificatif: s.justificatif?.statut ?? null,
    }));

    const c = nouveauxCompteurs();
    seances.forEach((s) => cumuler(c, s));

    return { date: jour, total: lignes.length, synthese: synthese(c), lignes };
  }

  /** Fiche individuelle d'un enseignant sur une période. */
  async ficheEnseignant(enseignantId: string, query: RapportQueryDto) {
    const enseignant = await this.prisma.enseignant.findUnique({
      where: { id: enseignantId },
      include: { departement: true },
    });
    const seances = await this.seances({ ...query, enseignantId });
    const c = nouveauxCompteurs();
    seances.forEach((s) => cumuler(c, s));

    return {
      enseignant,
      periode: { debut: query.dateDebut, fin: query.dateFin },
      synthese: synthese(c),
      seances: seances.map((s) => ({
        id: s.id,
        date: isoDate(s.date),
        horaire: `${s.heureDebut} - ${s.heureFin}`,
        matiere: s.affectation.matiere.intitule,
        promotion: s.affectation.promotion.nom,
        salle: s.salle?.code ?? '—',
        statut: s.controle?.statut ?? 'NON_CONTROLE',
        dureeMinutes: s.controle?.dureeMinutes ?? 0,
        thematiqueTraitee: s.controle?.thematiqueTraitee ?? '',
        observation: s.controle?.observation ?? '',
      })),
    };
  }
}
