import { describe, expect, it } from 'vitest';

import { montantPaye, resteAPayer } from '../../src/shared/utils/finances';
import type { StatutPaiement } from '../../src/types';

function dossier(paiements: { statut: StatutPaiement; montant: number }[] | null, frais = 100000) {
  return { montantFrais: frais, paiements };
}

describe('shared/utils/finances', () => {
  it('ne compte que les paiements réussis', () => {
    expect(
      montantPaye(
        dossier([
          { statut: 'REUSSI', montant: 40000 },
          { statut: 'EN_ATTENTE', montant: 25000 },
          { statut: 'ECHOUE', montant: 10000 },
        ]),
      ),
    ).toBe(40000);
  });

  it('un dossier sans paiement ne doit rien', () => {
    expect(montantPaye(dossier([]))).toBe(0);
    expect(montantPaye(dossier(null))).toBe(0);
  });

  it('reste dû : les frais moins l’encaissé', () => {
    expect(resteAPayer(dossier([{ statut: 'REUSSI', montant: 40000 }]))).toBe(60000);
  });

  it('reste dû jamais négatif', () => {
    expect(resteAPayer(dossier([{ statut: 'REUSSI', montant: 150000 }]))).toBe(0);
  });
});
