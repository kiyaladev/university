/**
 * Identité de l'établissement imprimée sur les documents (en-tête, pied de
 * page, métadonnées). Une seule requête lit toutes les clés : les gabarits
 * relisaient jusqu'ici `NOM_ETABLISSEMENT` chacun de leur côté, avec trois
 * replis différents ('Université', valeur par défaut du catalogue…).
 */
import { Logger } from '@nestjs/common';
import { PARAMETRES_DEFAUT } from '../../modules/parametres/parametres.service';

export interface Etablissement {
  nom: string;
  sigle: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  /** URL ou data-URI du logo, si l'établissement en a déclaré un. */
  logo: string | null;
}

/** Clés de la table `Parametre` lues pour composer l'identité. */
export const CLES_ETABLISSEMENT = {
  nom: 'NOM_ETABLISSEMENT',
  sigle: 'SIGLE_ETABLISSEMENT',
  adresse: 'ADRESSE_ETABLISSEMENT',
  telephone: 'TELEPHONE_ETABLISSEMENT',
  email: 'EMAIL_ETABLISSEMENT',
  logo: 'LOGO_ETABLISSEMENT',
} as const;

/** Client minimal : le service Prisma, une transaction ou un double de test. */
export interface SourceParametres {
  parametre?: {
    findMany(args: {
      where: { cle: { in: string[] } };
      select: { cle: true; valeur: true };
    }): Promise<Array<{ cle: string; valeur: string }>>;
  };
}

const NOM_PAR_DEFAUT = PARAMETRES_DEFAUT.NOM_ETABLISSEMENT.valeur;
const journal = new Logger('Impression');

export function etablissementParDefaut(): Etablissement {
  return { nom: NOM_PAR_DEFAUT, sigle: null, adresse: null, telephone: null, email: null, logo: null };
}

/**
 * Lit en une requête les paramètres d'identité de l'établissement. Un
 * document ne doit pas échouer parce que la table des paramètres est
 * indisponible : on retombe alors sur le nom du catalogue par défaut.
 */
export async function chargerEtablissement(prisma: SourceParametres): Promise<Etablissement> {
  const etablissement = etablissementParDefaut();
  if (!prisma?.parametre?.findMany) return etablissement;

  let lignes: Array<{ cle: string; valeur: string }> = [];
  try {
    lignes = await prisma.parametre.findMany({
      where: { cle: { in: Object.values(CLES_ETABLISSEMENT) } },
      select: { cle: true, valeur: true },
    });
  } catch (erreur) {
    journal.warn(`Paramètres de l'établissement illisibles : ${(erreur as Error)?.message ?? erreur}`);
    return etablissement;
  }

  const valeurs = new Map((lignes ?? []).map((l) => [l.cle, l.valeur?.trim() ?? '']));
  for (const [champ, cle] of Object.entries(CLES_ETABLISSEMENT) as Array<[keyof Etablissement, string]>) {
    const valeur = valeurs.get(cle);
    if (valeur) etablissement[champ] = valeur;
  }
  return etablissement;
}
