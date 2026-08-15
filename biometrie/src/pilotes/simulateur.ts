/**
 * Pilote de démonstration : permet de dérouler tout le circuit (enrôlement,
 * lecture en salle, refus d'un doigt inconnu) sans lecteur physique.
 *
 * Le doigt « lu » est celui indiqué par la variable DOIGT_SIMULE ; par défaut
 * la passerelle reproduit le gabarit demandé, ce qui simule une correspondance.
 */
import type { Capture, PiloteLecteur } from '../pilote';

export class PiloteSimulateur implements PiloteLecteur {
  readonly nom = 'simulateur';

  /** Gabarit que le « doigt posé » produira à la prochaine capture. */
  private prochainGabarit: string | null = null;

  async initialiser() {
    console.log('[biometrie] pilote simulateur actif — aucun lecteur physique requis');
  }

  /** Utilisé par le serveur : la vérification simule le doigt de l'enseignant. */
  preparerDoigt(gabarit: string | null) {
    this.prochainGabarit = gabarit;
  }

  async capturer(): Promise<Capture> {
    // Délai réaliste : le temps que l'enseignant pose le doigt.
    await new Promise((r) => setTimeout(r, 400));
    const template =
      this.prochainGabarit ?? `SIMU-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    return { template, qualite: 70 + Math.floor(Math.random() * 30) };
  }

  async comparer(gabaritEnrole: string, gabaritCapture: string): Promise<number> {
    if (!gabaritEnrole || !gabaritCapture) return 0;
    if (gabaritEnrole === gabaritCapture) return 88 + Math.floor(Math.random() * 10);

    // Score faible mais non nul, comme un vrai moteur de comparaison.
    const communs = [...gabaritEnrole].filter((c, i) => gabaritCapture[i] === c).length;
    return Math.min(45, Math.round((communs / Math.max(gabaritEnrole.length, 1)) * 45));
  }
}
