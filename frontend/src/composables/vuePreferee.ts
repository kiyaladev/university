/**
 * Choix « tableau ou cartes » d'un listing, retenu d'une visite à l'autre.
 *
 * Le tableau compare, la carte se lit. Sur un écran large on compare, sur un
 * téléphone on lit : le premier affichage suit l'écran, et dès que
 * l'utilisateur tranche, c'est son choix qui vaut — y compris s'il préfère le
 * tableau sur téléphone.
 */
import { ref, watch, type Ref } from 'vue';
import { Screen } from 'quasar';

export type ModeVue = 'tableau' | 'cartes';

const PREFIXE = 'unipresence_vue_';

export function useVuePreferee(cle: string): Ref<ModeVue> {
  let memorise: string | null = null;
  try { memorise = localStorage.getItem(PREFIXE + cle); } catch { /* préférence indisponible */ }
  const mode = ref<ModeVue>(memorise === 'tableau' || memorise === 'cartes' ? memorise : Screen.lt.md ? 'cartes' : 'tableau');

  watch(mode, (v) => { try { localStorage.setItem(PREFIXE + cle, v); } catch { /* choix conservé pour cette visite */ } });
  return mode;
}
