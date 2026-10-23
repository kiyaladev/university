/** Exploitation statistique du contrôle : tableaux de bord, taux d'assiduité,
 *  suivi du volume horaire réalisé et état de paiement des vacataires. */
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StatutPresence, StatutSeance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { dureeMinutes, isoDate, pct, round2, toDateOnly } from '../../common/utils';
import { RapportQueryDto } from './rapports.dto';

const CONTROLE_RAPPORT_SELECT = {
  id: true,
  controleurId: true,
  statut: true,
  heureArrivee: true,
  heureFinReelle: true,
  dureeMinutes: true,
  effectifPresent: true,
  thematiqueTraitee: true,
  observation: true,
  methode: true,
  attestation: true,
  attestationValide: true,
  signatureBase64: true,
};
const { signatureBase64: _signatureBase64, ...CONTROLE_RAPPORT_SELECT_SANS_SIGNATURE } = CONTROLE_RAPPORT_SELECT;
const {
  signatureBase64: _signatureSelectee,
  observation: _observationSelectee,
  ...CONTROLE_RAPPORT_SELECT_RESTREINT
} = CONTROLE_RAPPORT_SELECT;

const SEANCE_STATS_INCLUDE = {
  controle: { select: CONTROLE_RAPPORT_SELECT },
  controleurAssigne: { select: { id: true, nom: true, prenom: true } },
  salle: { select: { id: true, code: true, nom: true, batiment: true, capacite: true } },
  justificatif: { select: { statut: true } },
  affectation: {
    include: {
      enseignant: {
        select: {
          id: true,
          matricule: true,
          nom: true,
          prenom: true,
          grade: true,
          statut: true,
          tauxHoraire: true,
          departement: { select: { id: true, nom: true } },
        },
      },
      matiere: { select: { code: true, intitule: true } },
      promotion: { select: { nom: true } },
    },
  },
} satisfies Prisma.SeanceInclude;

const SEANCE_STATS_INCLUDE_SANS_SIGNATURE = {
  ...SEANCE_STATS_INCLUDE,
  controle: { select: CONTROLE_RAPPORT_SELECT_SANS_SIGNATURE },
} satisfies Prisma.SeanceInclude;

const SEANCE_STATS_INCLUDE_RESTREINT = {
  ...SEANCE_STATS_INCLUDE,
  controle: { select: CONTROLE_RAPPORT_SELECT_RESTREINT },
} satisfies Prisma.SeanceInclude;

type SeanceComplete = Prisma.SeanceGetPayload<{ include: typeof SEANCE_STATS_INCLUDE }>;

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

const PERIODE_RAPPORT_DEFAUT_JOURS = 30;
const PERIODE_RAPPORT_MAX_JOURS = 366;
const JOUR_MS = 24 * 60 * 60 * 1000;

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

  private where(query: RapportQueryDto, _user?: AuthUser): Prisma.SeanceWhereInput {
    const jour = query.date && !query.dateDebut && !query.dateFin ? toDateOnly(query.date) : undefined;
    const fin = jour ?? toDateOnly(query.dateFin ?? isoDate(new Date()));
    const debut =
      jour ??
      (query.dateDebut
        ? toDateOnly(query.dateDebut)
        : new Date(fin.getTime() - (PERIODE_RAPPORT_DEFAUT_JOURS - 1) * JOUR_MS));
    const jours = Math.floor((fin.getTime() - debut.getTime()) / JOUR_MS) + 1;
    if (jours < 1) {
      throw new BadRequestException('La date de début doit précéder ou égaler la date de fin.');
    }
    if (jours > PERIODE_RAPPORT_MAX_JOURS) {
      throw new BadRequestException(`La période d’un rapport ne peut dépasser ${PERIODE_RAPPORT_MAX_JOURS} jours.`);
    }
    const date: Prisma.DateTimeFilter = { gte: debut, lte: fin };

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

  private seances(query: RapportQueryDto, user?: AuthUser, inclureSignatures = false, inclureObservations = false) {
    return this.prisma.seance.findMany({
      where: this.where(query, user),
      include: inclureSignatures
        ? SEANCE_STATS_INCLUDE
        : inclureObservations
          ? SEANCE_STATS_INCLUDE_SANS_SIGNATURE
          : SEANCE_STATS_INCLUDE_RESTREINT,
      orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
    }) as Promise<SeanceComplete[]>;
  }

  // ------------------------------------------------------------- tableau de bord

  async dashboard(query: RapportQueryDto) {
    const aujourdhui = isoDate(new Date());
    const debutPeriode = query.dateDebut ?? isoDate(new Date(Date.now() - 29 * 86400000));
    const finPeriode = query.dateFin ?? aujourdhui;

    const [seancesPeriode, seancesJour, justificatifsEnAttente] = await Promise.all([
      this.seances({ ...query, dateDebut: debutPeriode, dateFin: finPeriode }),
      this.seances({ ...query, dateDebut: aujourdhui, dateFin: aujourdhui }),
      this.prisma.justificatif.count({
        where: {
          statut: 'EN_ATTENTE',
          ...(query.enseignantId ? { enseignantId: query.enseignantId } : {}),
          ...(query.departementId ? { enseignant: { departementId: query.departementId } } : {}),
        },
      }),
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

  /**
   * Mesure la couverture des tournées à partir des séances explicitement
   * attribuées. Une séance contrôlée par un collègue compte comme visitée,
   * mais reste distinguée de celle réalisée par le contrôleur attendu.
   */
  async couvertureControleurs(query: RapportQueryDto) {
    const seances = await this.seances(query);
    const aujourdhui = isoDate(new Date());
    const groupes = new Map<
      string,
      { controleur: { id: string; nom: string; prenom: string }; seances: SeanceComplete[] }
    >();
    const nonAffectees: SeanceComplete[] = [];

    for (const seance of seances) {
      const controleur = seance.controleurAssigne;
      if (!controleur) {
        nonAffectees.push(seance);
        continue;
      }
      if (!groupes.has(controleur.id)) groupes.set(controleur.id, { controleur, seances: [] });
      groupes.get(controleur.id)!.seances.push(seance);
    }

    const resume = (liste: SeanceComplete[]) => {
      const passees = liste.filter((s) => isoDate(s.date) <= aujourdhui);
      const visitees = passees.filter((s) => s.controle);
      const parAssigne = visitees.filter((s) => s.controle?.controleurId === s.controleurAssigne?.id);
      return {
        seancesPlanifiees: liste.length,
        seancesPassees: passees.length,
        visitees: visitees.length,
        nonVisitees: passees.length - visitees.length,
        realiseesParAssigne: parAssigne.length,
        realiseesParUnAutre: visitees.length - parAssigne.length,
        tauxCouverture: pct(visitees.length, passees.length),
        tauxParAssigne: pct(parAssigne.length, passees.length),
      };
    };

    return {
      periode: { debut: query.dateDebut, fin: query.dateFin },
      nonAffectees: resume(nonAffectees),
      lignes: [...groupes.values()]
        .map(({ controleur, seances: liste }) => ({
          controleurId: controleur.id,
          nom: `${controleur.prenom} ${controleur.nom}`,
          ...resume(liste),
        }))
        .sort((a, b) => a.nom.localeCompare(b.nom)),
    };
  }

  // ------------------------------------------------------------------ registre

  /** Registre de contrôle : la transcription fidèle du cahier du contrôleur. */
  async registre(query: RapportQueryDto, inclureSignatures = false, inclureObservations = false) {
    const jour = query.date ?? query.dateDebut ?? isoDate(new Date());
    const seances = await this.seances(
      { ...query, dateDebut: jour, dateFin: query.dateFin ?? jour },
      undefined,
      inclureSignatures,
      inclureObservations,
    );

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
      observation: inclureObservations ? (s.controle?.observation ?? '') : '',
      methode: s.controle?.methode ?? null,
      attestation: s.controle?.attestation ?? null,
      attestationValide: s.controle?.attestationValide ?? false,
      justificatif: s.justificatif?.statut ?? null,
      ...(inclureSignatures ? { signatureBase64: s.controle?.signatureBase64 ?? null } : {}),
    }));

    const c = nouveauxCompteurs();
    seances.forEach((s) => cumuler(c, s));

    return { date: jour, total: lignes.length, synthese: synthese(c), lignes };
  }

  /** Fiche individuelle d'un enseignant sur une période. */
  async ficheEnseignant(enseignantId: string, query: RapportQueryDto, inclureObservations = false) {
    const enseignant = await this.prisma.enseignant.findUnique({
      where: { id: enseignantId },
      select: {
        id: true,
        matricule: true,
        nom: true,
        prenom: true,
        grade: true,
        statut: true,
        departementId: true,
        departement: { select: { id: true, code: true, nom: true } },
      },
    });
    const seances = await this.seances({ ...query, enseignantId }, undefined, false, inclureObservations);
    const c = nouveauxCompteurs();
    seances.forEach((s) => cumuler(c, s));
    const identiteEnseignant = enseignant
      ? {
          id: enseignant.id,
          matricule: enseignant.matricule,
          nom: enseignant.nom,
          prenom: enseignant.prenom,
          grade: enseignant.grade,
          statut: enseignant.statut,
          departementId: enseignant.departementId,
          departement: enseignant.departement
            ? {
                id: enseignant.departement.id,
                code: enseignant.departement.code,
                nom: enseignant.departement.nom,
              }
            : null,
        }
      : null;

    return {
      enseignant: identiteEnseignant,
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
        observation: inclureObservations ? (s.controle?.observation ?? '') : '',
      })),
    };
  }
}
