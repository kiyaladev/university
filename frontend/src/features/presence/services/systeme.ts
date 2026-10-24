import { api } from '@/boot/axios';

/**
 * État du serveur (`/health`).
 *
 * La tournée prépare le cache hors ligne en interrogeant le serveur : un
 * simple « es-tu là ? » suffit, et la réponse n'a pas d'intérêt.
 */

/**
 * Vérifie que le serveur répond.
 *
 * Le paramètre `_tournee` évite qu'une réponse gardée en cache soit renvoyée :
 * la tournée doit savoir que le réseau est vraiment là.
 */
export async function verifierServeur(): Promise<void> {
  await api.get('/health', { params: { _tournee: Date.now() } });
}
