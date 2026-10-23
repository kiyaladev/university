import { computed } from 'vue';
import { useQuasar } from 'quasar';

/** Une seule présentation par appareil, réactive aux changements de largeur. */
export function usePresentationListe() {
  const $q = useQuasar();
  return computed<'tableau' | 'cartes'>(() => ($q.screen.lt.md ? 'cartes' : 'tableau'));
}
