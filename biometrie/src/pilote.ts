/**
 * Contrat que doit remplir un pilote de lecteur d'empreintes.
 *
 * Le SDK du constructeur (ZKTeco, SecuGen, Futronic, Mantra…) reste confiné
 * ici : ni l'application web ni l'API ne manipulent jamais le matériel, elles
 * ne voient que des gabarits opaques et des scores de correspondance.
 *
 * Un pilote ne fait que trois choses : ouvrir le lecteur, rendre le gabarit du
 * doigt posé, comparer deux gabarits. Tout le reste — signature, horodatage,
 * anti-rejeu — relève de la passerelle, qui est identique quel que soit le
 * matériel.
 */
export interface Capture {
  /** Gabarit opaque (minuties encodées), jamais l'image du doigt. */
  template: string;
  /** Qualité de la capture, 0 à 100. */
  qualite: number;
  /** Doigt ayant servi à la capture, pour le message d'accueil au contrôleur. */
  doigt?: string;
}

export interface PiloteLecteur {
  /** Nom du pilote, affiché dans l'état de la passerelle. */
  readonly nom: string;

  /**
   * Vrai pour un pilote de démonstration : les scores qu'il renvoie ne prouvent
   * alors rien, et l'interface doit le dire à l'écran.
   */
  readonly simule: boolean;

  /** Ouvre le lecteur ; lève une erreur s'il n'est pas branché. */
  initialiser(): Promise<void>;

  /** Attend que l'enseignant pose le doigt et renvoie un gabarit. */
  capturer(): Promise<Capture>;

  /**
   * Pilotes de démonstration : indique le gabarit que la prochaine capture
   * rendra (ou `null` pour un doigt inconnu). Un vrai lecteur n'a rien à
   * préparer : le doigt est celui que l'enseignant pose.
   */
  preparerDoigt?(gabarit: string | null): void;

  /** Compare deux gabarits et renvoie un score de correspondance de 0 à 100. */
  comparer(gabaritEnrole: string, gabaritCapture: string): Promise<number>;

  fermer?(): Promise<void>;
}

/**
 * Pilotes envisageables — aucun n'est livré ici, ce sont des pistes.
 *
 * • SecuGen Hamster Pro — SDK C/C++ (Windows, Linux) et FDapplet pour le web ;
 *  Packet API bien documentée, mais tightly liée à Windows pour l'installation.
 * • ZKTeco SLK20R / Live20R / ZKTeco SDK — très répandu en Afrique de l'Ouest,
 *  SDK pour Windows, Linux et Android ; protocole « push » ou « pull » selon
 *  les modèles.
 * • DigitalPersona — SDK multi-plateforme (Windows, Linux, macOS, Android,
 *  iOS) : le même pilote fonctionne sur le poste et sur le téléphone du
 *  contrôleur en USB-OTG.
 * • ZKTeco et DigitalPersona sont aussi les deux familles de lecteurs les plus
 *  répandues sur les kits Linux ; le SDK Android de ZKTeco permet de viser le
 *  téléphone du contrôleur en USB-OTG.
 * • Mantra MFS100 / Futronic FS80H — SDK Linux populaire, bon compromis
 *  prix/qualité pour les laboratoires.
 *
 * Ce qu'exige un pilote réel, quel que soit le constructeur :
 *   1. rendre le gabarit sous une forme stable et sérialisable (chaîne ASCII ou
 *      base64) : c'est ce que l'API chiffre et compare ;
 *   2. rendre un score stable, comparable à `EMPREINTE_SCORE_MIN` (60 par
 *      défaut) ;
 *   3. ne jamais sortir de ce contrat : le SDK n'est appelé qu'ici.
 *
 * Pour écrire un pilote : créer `src/pilotes/<constructeur>.ts`, implémenter
 * `initialiser`, `capturer` et `comparer`, puis l'enregistrer dans
 * `src/pilotes/index.ts` et le sélectionner par `BIOMETRIE_PILOTE=<nom>`.
 */
export type FabriquePilote = () => PiloteLecteur;
