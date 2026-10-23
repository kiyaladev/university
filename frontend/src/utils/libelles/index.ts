/**
 * Libellés partagés par les écrans, rangés par domaine. Ce module réexporte
 * tout, ainsi que les formateurs (`utils/format`) et la configuration de la
 * passerelle biométrique (`config/biometrie`) : les imports historiques
 * `from '../utils/libelles'` restent valables.
 */
export * from './traduire';
export * from './presence';
export * from './personnel';
export * from './scolarite';
export * from './finances';
export * from './administration';
export * from './campus';
export * from './recherche';
export * from './reclamations';
export * from '../format';
export * from '../../config/biometrie';
