/**
 * Contrat que doit remplir un pilote de lecteur d'empreintes.
 *
 * Le SDK du constructeur (ZKTeco, SecuGen, Futronic, Mantra…) reste confiné
 * ici : ni l'application web ni l'API ne manipulent jamais le matériel, elles
 * ne voient que des gabarits opaques et des scores de correspondance.
 */
export interface Capture {
  /** Gabarit opaque (minuties encodées), jamais l'image du doigt. */
  template: string;
  /** Qualité de la capture, 0 à 100. */
  qualite: number;
}

export interface PiloteLecteur {
  readonly nom: string;

  /** Ouvre le lecteur ; lève une erreur s'il n'est pas branché. */
  initialiser(): Promise<void>;

  /** Attend que l'enseignant pose le doigt et renvoie un gabarit. */
  capturer(): Promise<Capture>;

  /** Compare deux gabarits et renvoie un score de correspondance de 0 à 100. */
  comparer(gabaritEnrole: string, gabaritCapture: string): Promise<number>;

  fermer?(): Promise<void>;
}
