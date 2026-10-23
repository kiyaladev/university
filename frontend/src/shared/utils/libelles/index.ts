/**
 * Libellés partagés par les écrans, rangés par domaine. Ce module réexporte
 * tout, ainsi que les formateurs (`shared/utils/format`) et la configuration de
 * la passerelle biométrique (`shared/utils/biometrie`) : un seul import
 * `from '@/shared/utils/libelles'` suffit.
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
export * from '../biometrie';
