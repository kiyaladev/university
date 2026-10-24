/**
 * Messages de la passerelle, en français et en anglais.
 *
 * La passerelle est un service local, séparé de l'API et de l'application : elle
 * ne peut pas réutiliser leurs catalogues i18n. Elle embarque donc le sien,
 * réduit aux messages qu'elle renvoie au contrôleur. La langue suit
 * `Accept-Language` quand le navigateur en envoie une, sinon celle de la
 * configuration, sinon le français.
 */

export type Langue = 'fr' | 'en';

export const LANGUES: Langue[] = ['fr', 'en'];

type Catalogue = Record<string, string>;

const FR: Catalogue = {
  'erreur.enseignantIdRequis': "L'identifiant de l'enseignant est requis.",
  'erreur.gabaritRequis': "Le gabarit de l'enseignant est requis.",
  'erreur.lectureImpossible': 'Lecture impossible.',
  'erreur.routeInconnue': 'Route inconnue.',
  'erreur.requeteInvalide': 'Requête invalide.',
  'erreur.rejeu': 'Résultat déjà émis : requête rejouée.',
  'erreur.horodatageHorsFenetre': "L'horodatage du résultat est hors de la fenêtre acceptée par l'API.",
  'etat.pasPret': "Le lecteur n'est pas prêt.",
};

const EN: Catalogue = {
  'erreur.enseignantIdRequis': "The teacher's identifier is required.",
  'erreur.gabaritRequis': "The teacher's template is required.",
  'erreur.lectureImpossible': 'Capture failed.',
  'erreur.routeInconnue': 'Unknown route.',
  'erreur.requeteInvalide': 'Invalid request.',
  'erreur.rejeu': 'Result already issued: replayed request.',
  'erreur.horodatageHorsFenetre': "The result timestamp is outside the window accepted by the API.",
  'etat.pasPret': 'The reader is not ready.',
};

const CATALOGUES: Record<Langue, Catalogue> = { fr: FR, en: EN };

/** Langue demandée par un en-tête `Accept-Language`, si elle est connue. */
export function langueDepuisEntete(entete: string | null): Langue | null {
  if (!entete) return null;
  for (const partie of entete.split(',')) {
    const code = partie.split(';')[0]!.trim().toLowerCase();
    if (code.startsWith('fr')) return 'fr';
    if (code.startsWith('en')) return 'en';
  }
  return null;
}

/** Message traduit, avec repli sur le français puis sur la clé elle-même. */
export function t(cle: string, langue: Langue = 'fr'): string {
  return CATALOGUES[langue][cle] ?? FR[cle] ?? cle;
}
