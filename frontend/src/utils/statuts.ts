/**
 * Table unique des tons de statut : pour chaque domaine, statut → ton.
 *
 * Le ton dit le sens d'un état, pas sa teinte ; la teinte est fixée une fois
 * pour toutes par `PastilleStatut.vue`, dans la palette de DESIGN.md :
 *
 *   positif   → vert #007A4D sur vert dilué : acquis, en cours d'aboutissement
 *   attention → ocre #8A6300 sur jaune dilué : attente, à traiter (le jaune ne porte pas de texte)
 *   negatif   → rouge #CE1126 sur rouge dilué : refus, échec, annulation subie
 *   neutre    → encre douce sur gris inerte : brouillon, état de départ, sans enjeu
 *   info      → encre pleine sur gris inerte : clos, rangé (« la règle du gris terminal »)
 *
 * Les présences gardent leur propre grammaire (`ChampStatut.vue`) : six états
 * et leurs variantes de nuance (remplacé, départ anticipé, excusé).
 */
import type {
  DecisionJury,
  StadeTirage,
  StatutAttestation,
  StatutAttributionLogement,
  StatutBadge,
  StatutCarteEtudiante,
  StatutChambre,
  StatutConsommation,
  StatutCourrier,
  StatutDeliberation,
  StatutDemande,
  StatutElection,
  StatutEncadrement,
  StatutEnseignant,
  StatutEvaluation,
  StatutExamen,
  StatutFormation,
  StatutInscription,
  StatutInscriptionFormation,
  StatutJustificatif,
  StatutNotification,
  StatutPaie,
  StatutPaiement,
  StatutPresence,
  StatutReclamation,
  StatutReservationSalle,
  StatutTicket,
  StatutVOD,
  SuspicionPlagiat,
} from '../types';
import {
  LIBELLE_DECISION_JURY,
  LIBELLE_STADE_TIRAGE,
  LIBELLE_STATUT_ATTESTATION,
  LIBELLE_STATUT_ATTRIBUTION,
  LIBELLE_STATUT_BADGE,
  LIBELLE_STATUT_CARTE,
  LIBELLE_STATUT_CHAMBRE,
  LIBELLE_STATUT_CONSOMMATION,
  LIBELLE_STATUT_COURRIER,
  LIBELLE_STATUT_DELIBERATION,
  LIBELLE_STATUT_DEMANDE,
  LIBELLE_STATUT_ELECTION,
  LIBELLE_STATUT_ENCADREMENT,
  LIBELLE_STATUT_ENSEIGNANT,
  LIBELLE_STATUT_EVALUATION,
  LIBELLE_STATUT_EXAMEN,
  LIBELLE_STATUT_FORMATION,
  LIBELLE_STATUT_INSCRIPTION,
  LIBELLE_STATUT_INSCRIPTION_FORMATION,
  LIBELLE_STATUT_JUSTIFICATIF,
  LIBELLE_STATUT_NOTIFICATION,
  LIBELLE_STATUT_PAIE,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_STATUT_RECETTE,
  LIBELLE_STATUT_RECLAMATION,
  LIBELLE_STATUT_RESERVATION,
  LIBELLE_STATUT_SUSPICION,
  LIBELLE_STATUT_TICKET,
  LIBELLE_STATUT_VOD,
} from './libelles';

export type Ton = 'positif' | 'attention' | 'negatif' | 'neutre' | 'info';

export const TONS: readonly Ton[] = ['positif', 'attention', 'negatif', 'neutre', 'info'];

/** Statuts de délibération connus des libellés au-delà du type `StatutDeliberation`. */
type StatutDeliberationEtendu = StatutDeliberation | 'PROPOSE' | 'VALIDE' | 'SOUTENU' | 'ABANDONNE';

const TONS_STATUT = {
  paiement: {
    EN_ATTENTE: 'attention',
    REUSSI: 'positif',
    ECHOUE: 'negatif',
    ANNULE: 'neutre',
    REMBOURSE: 'neutre',
  } satisfies Record<StatutPaiement, Ton>,
  inscription: {
    BROUILLON: 'neutre',
    EN_ATTENTE_PAIEMENT: 'attention',
    PAYEE: 'positif',
    VALIDEE: 'positif',
    ANNULEE: 'negatif',
  } satisfies Record<StatutInscription, Ton>,
  paie: {
    BROUILLON: 'neutre',
    VALIDEE: 'positif',
    PAYEE: 'info',
  } satisfies Record<StatutPaie, Ton>,
  recette: {
    ENCAISSEE: 'positif',
    A_ENCAISSER: 'neutre',
  } satisfies Record<keyof typeof LIBELLE_STATUT_RECETTE, Ton>,
  evaluation: {
    OUVERTE: 'positif',
    CLOTUREE: 'neutre',
  } satisfies Record<StatutEvaluation, Ton>,
  deliberation: {
    BROUILLON: 'attention',
    VALIDEE: 'positif',
    PROPOSE: 'neutre',
    VALIDE: 'positif',
    SOUTENU: 'positif',
    ABANDONNE: 'negatif',
  } satisfies Record<StatutDeliberationEtendu, Ton>,
  decision: {
    ADMIS: 'positif',
    AJOURNE: 'attention',
    DEFAILLANT: 'negatif',
  } satisfies Record<DecisionJury, Ton>,
  attestation: {
    EMISE: 'positif',
    REVOQUEE: 'negatif',
  } satisfies Record<StatutAttestation, Ton>,
  carte: {
    EMISE: 'positif',
    REVOQUEE: 'negatif',
  } satisfies Record<StatutCarteEtudiante, Ton>,
  notification: {
    EN_ATTENTE: 'attention',
    ENVOYEE: 'positif',
    ECHOUE: 'negatif',
  } satisfies Record<StatutNotification, Ton>,
  courrier: {
    RECU: 'neutre',
    ENREGISTRE: 'neutre',
    EN_CIRCUIT: 'attention',
    TRAITE: 'positif',
    CLASSE: 'info',
    ARCHIVE: 'info',
  } satisfies Record<StatutCourrier, Ton>,
  examen: {
    PLANIFIE: 'info',
    EN_COURS: 'attention',
    TERMINE: 'positif',
    ANNULE: 'negatif',
  } satisfies Record<StatutExamen, Ton>,
  tirage: {
    PROGRAMME: 'neutre',
    IMPRIME: 'attention',
    MIS_SOUS_PLI: 'attention',
    DISTRIBUE: 'positif',
    RECUPERE: 'info',
    ANNULE: 'negatif',
  } satisfies Record<StadeTirage, Ton>,
  badge: {
    ACTIF: 'positif',
    EXPIRE: 'attention',
    ANNULE: 'negatif',
  } satisfies Record<StatutBadge, Ton>,
  election: {
    BROUILLON: 'neutre',
    OUVERTE: 'positif',
    CLOSE: 'attention',
    PROCLAMEE: 'info',
    ANNULEE: 'negatif',
  } satisfies Record<StatutElection, Ton>,
  chambre: {
    LIBRE: 'positif',
    RESERVEE: 'attention',
    OCCUPEE: 'neutre',
    MAINTENANCE: 'negatif',
  } satisfies Record<StatutChambre, Ton>,
  attribution: {
    EN_ATTENTE: 'neutre',
    ACCORDEE: 'positif',
    REFUSEE: 'negatif',
    RETIREE: 'attention',
  } satisfies Record<StatutAttributionLogement, Ton>,
  consommation: {
    EN_ATTENTE: 'neutre',
    VALIDEE: 'positif',
    ANNULEE: 'attention',
  } satisfies Record<StatutConsommation, Ton>,
  reservation: {
    EN_ATTENTE: 'attention',
    CONFIRMEE: 'positif',
    REFUSEE: 'negatif',
    ANNULEE: 'neutre',
  } satisfies Record<StatutReservationSalle, Ton>,
  ticket: {
    OUVERT: 'attention',
    EN_COURS: 'positif',
    RESOLU: 'positif',
    CLOTURE: 'neutre',
  } satisfies Record<StatutTicket, Ton>,
  formation: {
    BROUILLON: 'neutre',
    PUBLIEE: 'positif',
    COMPLETE: 'attention',
  } satisfies Record<StatutFormation, Ton>,
  inscriptionFormation: {
    EN_ATTENTE: 'attention',
    CONFIRMEE: 'positif',
    ANNULEE: 'negatif',
  } satisfies Record<StatutInscriptionFormation, Ton>,
  stage: {
    PROPOSE: 'neutre',
    VALIDE: 'info',
    EN_COURS: 'positif',
    SOUTENU: 'positif',
    ABANDONNE: 'negatif',
  } satisfies Record<StatutEncadrement, Ton>,
  suspicion: {
    EN_ATTENTE: 'attention',
    ACQUITTE: 'positif',
    CONFIRME: 'negatif',
  } satisfies Record<SuspicionPlagiat['statut'], Ton>,
  vod: {
    BROUILLON: 'neutre',
    EN_LIGNE: 'positif',
    HORS_LIGNE: 'attention',
    ARCHIVE: 'info',
  } satisfies Record<StatutVOD, Ton>,
  reclamation: {
    OUVERTE: 'attention',
    EN_COURS: 'positif',
    EN_ATTENTE_REPONSE: 'neutre',
    RESOLUE: 'positif',
    FERMEE: 'neutre',
    REJETEE: 'negatif',
  } satisfies Record<StatutReclamation, Ton>,
  demande: {
    EN_ATTENTE_PAIEMENT: 'attention',
    PAYEE: 'positif',
    EN_TRAITEMENT: 'positif',
    PRETE: 'positif',
    REMISE: 'info',
    REJETEE: 'negatif',
  } satisfies Record<StatutDemande, Ton>,
  justificatif: {
    EN_ATTENTE: 'attention',
    VALIDE: 'positif',
    REJETE: 'negatif',
  } satisfies Record<StatutJustificatif, Ton>,
  /** Statut d'emploi, pas un état : aucun n'est « bon » ni « mauvais ». */
  enseignant: {
    PERMANENT: 'info',
    VACATAIRE: 'neutre',
    CONTRACTUEL: 'neutre',
  } satisfies Record<StatutEnseignant, Ton>,
};

export type DomaineStatut = keyof typeof TONS_STATUT;

/** Libellés de chaque domaine : ceux de utils/libelles, jamais redits ici. */
export const LIBELLES_STATUT: Record<DomaineStatut, Record<string, string>> = {
  paiement: LIBELLE_STATUT_PAIEMENT,
  inscription: LIBELLE_STATUT_INSCRIPTION,
  paie: LIBELLE_STATUT_PAIE,
  recette: LIBELLE_STATUT_RECETTE,
  evaluation: LIBELLE_STATUT_EVALUATION,
  deliberation: LIBELLE_STATUT_DELIBERATION,
  decision: LIBELLE_DECISION_JURY,
  attestation: LIBELLE_STATUT_ATTESTATION,
  carte: LIBELLE_STATUT_CARTE,
  notification: LIBELLE_STATUT_NOTIFICATION,
  courrier: LIBELLE_STATUT_COURRIER,
  examen: LIBELLE_STATUT_EXAMEN,
  tirage: LIBELLE_STADE_TIRAGE,
  badge: LIBELLE_STATUT_BADGE,
  election: LIBELLE_STATUT_ELECTION,
  chambre: LIBELLE_STATUT_CHAMBRE,
  attribution: LIBELLE_STATUT_ATTRIBUTION,
  consommation: LIBELLE_STATUT_CONSOMMATION,
  reservation: LIBELLE_STATUT_RESERVATION,
  ticket: LIBELLE_STATUT_TICKET,
  formation: LIBELLE_STATUT_FORMATION,
  inscriptionFormation: LIBELLE_STATUT_INSCRIPTION_FORMATION,
  stage: LIBELLE_STATUT_ENCADREMENT,
  suspicion: LIBELLE_STATUT_SUSPICION,
  vod: LIBELLE_STATUT_VOD,
  reclamation: LIBELLE_STATUT_RECLAMATION,
  demande: LIBELLE_STATUT_DEMANDE,
  justificatif: LIBELLE_STATUT_JUSTIFICATIF,
  enseignant: LIBELLE_STATUT_ENSEIGNANT,
};

export const TONS_PAR_DOMAINE: Record<DomaineStatut, Record<string, Ton>> = TONS_STATUT;

/** Ton d'un statut ; un statut inconnu (ou absent) reste neutre. */
export function tonStatut(domaine: DomaineStatut, statut?: string | null): Ton {
  return (statut && TONS_PAR_DOMAINE[domaine][statut]) || 'neutre';
}

/** Libellé d'un statut ; à défaut, le code brut plutôt qu'un vide. */
export function libelleStatut(domaine: DomaineStatut, statut?: string | null): string {
  if (!statut) return '—';
  return LIBELLES_STATUT[domaine][statut] ?? statut;
}

/**
 * Présences : un champ peint (`.champ--<classe>` d'app.scss), pas une pastille.
 * La table sert à `ChampStatut.vue` et à la tournée du contrôleur.
 */
export const CLASSE_CHAMP_PRESENCE: Record<StatutPresence, string> = {
  PRESENT: 'present',
  RETARD: 'retard',
  ABSENT: 'absent',
  EXCUSE: 'excuse',
  REMPLACE: 'remplace',
  DEPART_ANTICIPE: 'depart',
};
