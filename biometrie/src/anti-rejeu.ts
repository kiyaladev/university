/**
 * Registre anti-rejeu de la passerelle.
 *
 * L'API vérifie la signature et la fraîcheur (5 minutes), mais elle n'a pas de
 * nonce : une preuve capturée reste rejouable pendant toute sa fenêtre
 * d'acceptation. La passerelle ne peut pas réparer cela à sa place — seule
 * l'API peut, en consommant chaque résultat — mais elle peut empêcher qu'une
 * *même* lecture produise plusieurs preuves valides.
 *
 * Elle tient donc deux tables, purgées au-delà de la fenêtre :
 *   • les charges signées : une charge déjà signée ne l'est plus (rejeu d'un
 *     résultat déjà émis) ;
 *   • les identifiants de tentative fournis par le client : une tentative déjà
 *     traitée ne l'est plus (rejeu d'une même requête).
 */
import { FRAICHEUR_RESULTAT_MS } from './signature';

export interface OptionsRegistre {
  /** Durée de vie d'une entrée, alignée sur la fenêtre d'acceptation de l'API. */
  fenetreMs?: number;
  /** Horloge, injectable pour les tests. */
  maintenant?: () => number;
}

export class RegistreAntiRejeu {
  private readonly fenetreMs: number;
  private readonly maintenant: () => number;
  private readonly charges = new Map<string, number>();
  private readonly tentatives = new Map<string, number>();

  constructor(options: OptionsRegistre = {}) {
    this.fenetreMs = options.fenetreMs ?? FRAICHEUR_RESULTAT_MS;
    this.maintenant = options.maintenant ?? Date.now;
  }

  /** Cette charge a-t-elle déjà été signée dans la fenêtre ? */
  dejaSignee(charge: string): boolean {
    this.purger();
    return this.charges.has(charge);
  }

  /** Mémorise une charge signée. */
  enregistrerCharge(charge: string): void {
    this.purger();
    this.charges.set(charge, this.maintenant() + this.fenetreMs);
  }

  /** Cette tentative a-t-elle déjà été traitée dans la fenêtre ? */
  dejaTraitee(tentativeId: string): boolean {
    this.purger();
    return this.tentatives.has(tentativeId);
  }

  /** Mémorise une tentative traitée. */
  enregistrerTentative(tentativeId: string): void {
    this.purger();
    this.tentatives.set(tentativeId, this.maintenant() + this.fenetreMs);
  }

  /** Oublie les entrées hors fenêtre. */
  purger(): void {
    const instant = this.maintenant();
    for (const [cle, expiration] of this.charges) {
      if (expiration <= instant) this.charges.delete(cle);
    }
    for (const [cle, expiration] of this.tentatives) {
      if (expiration <= instant) this.tentatives.delete(cle);
    }
  }

  /** Nombre d'entrées encore valides (état, pour les tests et le diagnostic). */
  get taille(): number {
    this.purger();
    return this.charges.size + this.tentatives.size;
  }
}
