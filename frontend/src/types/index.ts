/**
 * Types partagés avec l'API University, découpés par domaine. Ce module les
 * réexporte tous : les imports existants `from '../types'` restent valables.
 *
 * Les énumérations ne sont pas recopiées : elles sont générées depuis le
 * schéma Prisma dans `types/generated/enums.ts` et réexportées par les
 * modules de domaine. Régénérer avec `bun run types:generer`.
 */
export * from './commun';
export * from './referentiels';
export * from './presence';
export * from './registre';
export * from './campus';
export * from './administration';
export * from './transverses';
export * from './rectorat';

/**
 * Plateforme de réclamations et de demandes de documents : le fichier de
 * feature garde ses propres déclarations (il n'est pas modifiable depuis
 * ici), les énumérations sont ici celles générées depuis le schéma Prisma.
 * Les deux écritures décrivent les mêmes valeurs : les types restent
 * compatibles.
 */
export type { DemandeDocument, MessageReclamation, Reclamation, TarifDemande } from '@/features/scolarite/types';
export type {
  PrioriteReclamation,
  StatutDemande,
  StatutReclamation,
  TypeDemandeDocument,
  TypeReclamation,
} from './generated/enums';
