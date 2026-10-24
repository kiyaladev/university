/**
 * Registre anti-rejeu : une lecture ne doit pas produire deux preuves valides.
 */
import { describe, expect, it } from 'bun:test';
import { RegistreAntiRejeu } from '../src/anti-rejeu';

describe('Registre anti-rejeu', () => {
  it('refuse une charge déjà signée', () => {
    const registre = new RegistreAntiRejeu();
    expect(registre.dejaSignee('verification|ens-1|abc')).toBe(false);
    registre.enregistrerCharge('verification|ens-1|abc');
    expect(registre.dejaSignee('verification|ens-1|abc')).toBe(true);
  });

  it('laisse passer une charge nouvelle', () => {
    const registre = new RegistreAntiRejeu();
    registre.enregistrerCharge('verification|ens-1|abc');
    expect(registre.dejaSignee('verification|ens-2|abc')).toBe(false);
  });

  it('refuse une tentative déjà traitée', () => {
    const registre = new RegistreAntiRejeu();
    expect(registre.dejaTraitee('tentative-1')).toBe(false);
    registre.enregistrerTentative('tentative-1');
    expect(registre.dejaTraitee('tentative-1')).toBe(true);
  });

  it('oublie les entrées une fois la fenêtre écoulée', () => {
    let instant = 1_000_000;
    const registre = new RegistreAntiRejeu({ fenetreMs: 1000, maintenant: () => instant });
    registre.enregistrerCharge('verification|ens-1|abc');
    registre.enregistrerTentative('tentative-1');
    expect(registre.dejaSignee('verification|ens-1|abc')).toBe(true);

    instant += 1001;
    expect(registre.dejaSignee('verification|ens-1|abc')).toBe(false);
    expect(registre.dejaTraitee('tentative-1')).toBe(false);
    expect(registre.taille).toBe(0);
  });

  it('aligne sa fenêtre sur celle de l’API par défaut', () => {
    let instant = 0;
    const registre = new RegistreAntiRejeu({ maintenant: () => instant });
    registre.enregistrerCharge('c');
    expect(registre.dejaSignee('c')).toBe(true);

    // Un peu plus de cinq minutes plus tard : la fenêtre est dépassée.
    instant = 5 * 60 * 1000 + 1;
    expect(registre.dejaSignee('c')).toBe(false);
  });
});
