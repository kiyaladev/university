/** Contrôle de présence : séances, contrôles, justificatifs, pointage et attestation. */

import type {
  Affectation,
  Enseignant,
  Role,
  Salle,
  StatutJustificatif,
  StatutPresence,
  StatutSeance,
  TypeCours,
  TypeJustificatif,
} from './referentiels';

export interface Controle {
  id: string;
  seanceId: string;
  controleurId: string;
  statut: StatutPresence;
  heureArrivee?: string | null;
  heureFinReelle?: string | null;
  dureeMinutes: number;
  effectifPresent?: number | null;
  thematiqueTraitee?: string | null;
  observation?: string | null;
  methode: 'MANUEL' | 'QR_SALLE' | 'GEOLOCALISATION' | 'SIGNATURE';
  latitude?: number | null;
  longitude?: number | null;
  distanceMetres?: number | null;
  signatureBase64?: string | null;
  qrSalleValide: boolean;
  attestation: AttestationMode;
  attestationValide: boolean;
  attestationLe?: string | null;
  empreinteScore?: number | null;
  horsLigne: boolean;
  horodatage: string;
  controleur?: { id: string; nom: string; prenom: string; role: Role };
  enseignantRemplacant?: { id: string; nom: string; prenom: string } | null;
  seance?: Seance;
}

export interface Justificatif {
  id: string;
  seanceId: string;
  enseignantId: string;
  type: TypeJustificatif;
  motif: string;
  piece?: string | null;
  statut: StatutJustificatif;
  commentaire?: string | null;
  traiteLe?: string | null;
  createdAt: string;
  enseignant?: Enseignant;
  traitePar?: { id: string; nom: string; prenom: string } | null;
  seance?: Seance;
}

export interface Seance {
  id: string;
  affectationId: string;
  anneeId: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  type: TypeCours;
  salleId?: string | null;
  statut: StatutSeance;
  thematique?: string | null;
  affectation?: Affectation;
  salle?: Salle | null;
  controle?: Controle | null;
  controleurAssigneId?: string | null;
  controleurAssigne?: { id: string; nom: string; prenom: string } | null;
  justificatif?: Justificatif | null;
}

export type AttestationMode = 'AUCUNE' | 'SIGNATURE' | 'CODE_PIN' | 'EMPREINTE';

/** Résultat signé par la passerelle biométrique locale. */
export interface PreuveEmpreinte {
  score: number;
  horodatage: string;
  signature: string;
  /** Appareil signataire, quand la lecture vient d'un lecteur embarqué. */
  appareilId?: string;
}

/** Moyens d'attestation dont dispose un enseignant. */
export interface MoyensAttestation {
  codePin: boolean;
  empreinte: boolean;
  empreinteDoigt?: string | null;
}

export interface Pointage {
  seanceId: string;
  statut?: StatutPresence;
  heureArrivee?: string;
  heureFinReelle?: string;
  effectifPresent?: number;
  thematiqueTraitee?: string;
  observation?: string;
  qrToken?: string;
  latitude?: number;
  longitude?: number;
  enseignantRemplacantId?: string;
  horsLigne?: boolean;
  horodatage?: string;

  // Attestation de l'enseignant : une seule de ces preuves suffit
  signatureBase64?: string;
  codePinEnseignant?: string;
  empreinte?: PreuveEmpreinte;
}
