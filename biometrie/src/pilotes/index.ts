/**
 * Registre des pilotes de lecture.
 *
 * Brancher un lecteur réel consiste à écrire `src/pilotes/<constructeur>.ts`,
 * à l'enregistrer ici, puis à lancer la passerelle avec
 * `BIOMETRIE_PILOTE=<nom>`. Rien d'autre ne change : signature, horodatage et
 * anti-rejeu sont indépendants du matériel.
 */
import type { FabriquePilote } from '../pilote';
import { PiloteSimulateur } from './simulateur';

export const PILOTES: Record<string, FabriquePilote> = {
  simulateur: () => new PiloteSimulateur(),
};

export { PiloteSimulateur };
