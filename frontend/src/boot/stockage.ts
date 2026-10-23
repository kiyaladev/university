/**
 * Reprise du stockage local au démarrage.
 *
 * L'application a porté le préfixe « unipresence_ » et la base IndexedDB du
 * même nom. Le produit s'appelle désormais University : les clés sont
 * reprises sous « university_ » et la base de chiffrement est renommée.
 *
 * Des téléphones et des navigateurs en service portent des sessions et des
 * files hors ligne qui n'ont jamais été synchronisées : la reprise est donc
 * exhaustive, idempotente, et jamais destructive. Elle précède le montage de
 * l'interface pour que la tournée s'ouvre avec ses séances en attente, même
 * sans réseau.
 */
import { defineBoot } from '#q-app/wrappers';
import { migrerCaches, migrerClesLocales } from '@/shared/services/cles-stockage';
import { migrerBaseCrypto } from '@/shared/services/file-chiffree';
import { prechargerFilesHorsLigne } from '@/shared/services/file-hors-ligne';
import { lireToken, proprietaireDepuisToken } from '@/shared/services/session';

export default defineBoot(async () => {
  // Les clés de stockage sont synchrones : la reprise est faite avant tout
  // le reste, pour qu'aucun service ne lise une clé abandonnée.
  migrerClesLocales();
  // Les clés de chiffrement de la base renommée sont recopiées, puis
  // l'ancienne base est retirée.
  await migrerBaseCrypto();
  // Les caches du service worker ne portent aucune donnée unique.
  await migrerCaches();
  try {
    await prechargerFilesHorsLigne(proprietaireDepuisToken(lireToken()));
  } catch (error) {
    // Une file illisible ne doit pas empêcher l'application de démarrer :
    // elle sera signalée par le store qui la lit.
    console.warn('Stockage local : file hors ligne illisible', error);
  }
});
