/**
 * Lecteur d'empreintes — une seule interface, deux façons de l'atteindre.
 *
 *   • Dans l'application Android, le lecteur est branché en USB-OTG sur le
 *     téléphone du contrôleur et se pilote par le greffon natif « Empreinte ».
 *   • Sur un poste fixe, il est branché sur la machine et se pilote par la
 *     passerelle locale en HTTP, comme avant.
 *
 * Le reste de l'application ne sait pas laquelle des deux répond : elle
 * demande une capture ou une vérification, et reçoit un résultat signé.
 *
 * Rappel qui gouverne tout ce fichier : le capteur intégré au téléphone ne
 * reconnaît que le propriétaire de l'appareil. Il ne peut donc jamais servir à
 * attester la présence d'un enseignant — seulement à déverrouiller la session
 * du contrôleur. C'est pourquoi un lecteur externe reste nécessaire.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { api } from '../boot/axios';
import { urlPasserelle, passerelleConfiguree } from '../utils/libelles';

export interface EtatLecteur {
  disponible: boolean;
  lecteur: string;
  /** Vrai quand aucun lecteur réel n'est branché : les scores ne prouvent rien. */
  simule: boolean;
  appareilEnrole?: boolean;
  sdkPresent?: boolean;
}

export interface CaptureEmpreinte {
  template: string;
  qualite: number;
  horodatage: string;
  signature: string;
  appareilId?: string;
}

export interface VerificationEmpreinte {
  score: number;
  horodatage: string;
  signature: string;
  appareilId?: string;
}

interface GreffonEmpreinte {
  etat(): Promise<EtatLecteur>;
  enroler(options: { enseignantId: string }): Promise<CaptureEmpreinte>;
  verifier(options: { enseignantId: string; gabarit: string }): Promise<VerificationEmpreinte>;
  fermer(): Promise<void>;
  enregistrerAppareil(options: { appareilId: string; secret: string }): Promise<unknown>;
  deverrouiller(): Promise<{ possible: boolean; ouvert: boolean; motif?: string }>;
}

const Empreinte = registerPlugin<GreffonEmpreinte>('Empreinte');

/** L'application tourne-t-elle dans l'APK Android ? */
export const surAndroid = () => Capacitor.isNativePlatform();

const CLE_APPAREIL = 'unipresence_appareil_enrole';

/**
 * Au premier usage, l'appareil réclame sa clé de signature au serveur. La clé
 * ne transite qu'une fois et va directement dans le coffre chiffré d'Android :
 * elle n'est jamais écrite dans le stockage du navigateur, où elle serait
 * lisible. Un appareil perdu se révoque côté serveur sans toucher aux autres.
 */
export async function enrolerAppareilSiNecessaire(libelle: string) {
  if (!surAndroid() || localStorage.getItem(CLE_APPAREIL)) return;

  const { data } = await api.post('/attestation/appareils', { libelle });
  await Empreinte.enregistrerAppareil({ appareilId: data.appareilId, secret: data.secret });
  // On ne retient ici que l'identifiant : le secret reste dans le coffre.
  localStorage.setItem(CLE_APPAREIL, data.appareilId);
}

export async function etatLecteur(): Promise<EtatLecteur> {
  if (surAndroid()) return Empreinte.etat();

  if (!passerelleConfiguree()) {
    return { disponible: false, lecteur: 'Aucun lecteur déclaré', simule: false };
  }

  try {
    const reponse = await fetch(`${urlPasserelle()}/etat`, { signal: AbortSignal.timeout(2500) });
    const etat = await reponse.json();
    return {
      disponible: !!etat.pret,
      lecteur: etat.lecteur ?? 'Passerelle biométrique',
      simule: !!etat.simule,
    };
  } catch {
    return { disponible: false, lecteur: 'Passerelle injoignable', simule: false };
  }
}

export async function capturerPourEnrolement(enseignantId: string): Promise<CaptureEmpreinte> {
  if (surAndroid()) return Empreinte.enroler({ enseignantId });

  const reponse = await fetch(`${urlPasserelle()}/enroler`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enseignantId }),
    signal: AbortSignal.timeout(30000),
  });
  const capture = await reponse.json();
  if (!reponse.ok) throw new Error(capture.erreur ?? 'Lecture impossible');
  return capture;
}

export async function verifierEmpreinte(
  enseignantId: string,
  gabarit: string,
): Promise<VerificationEmpreinte> {
  if (surAndroid()) return Empreinte.verifier({ enseignantId, gabarit });

  const reponse = await fetch(`${urlPasserelle()}/verifier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enseignantId, gabarit }),
    signal: AbortSignal.timeout(30000),
  });
  const resultat = await reponse.json();
  if (!reponse.ok) throw new Error(resultat.erreur ?? 'Lecture impossible');
  return resultat;
}

/**
 * Déverrouillage de la tournée par le capteur du téléphone. Ne prouve rien sur
 * un enseignant : vérifie seulement que l'appareil est entre les mains de son
 * porteur. Renvoie `true` quand il n'y a rien à vérifier (poste fixe).
 */
export async function deverrouillerSession(): Promise<boolean> {
  if (!surAndroid()) return true;
  const res = await Empreinte.deverrouiller();
  return !res.possible || res.ouvert;
}

export async function fermerLecteur() {
  if (surAndroid()) await Empreinte.fermer();
}
