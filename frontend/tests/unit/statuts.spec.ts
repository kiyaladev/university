import { describe, expect, it, vi } from 'vitest';

// `utils/libelles` lit les traductions dans boot/i18n, qui dépend de
// l'application Quasar : un catalogue vide suffit (libellés français).
vi.mock('../../src/boot/i18n', () => ({
  getAppLocale: () => 'fr-FR',
  i18n: { global: { te: () => false, t: (cle: string) => cle } },
}));

import {
  CLASSE_CHAMP_PRESENCE,
  LIBELLES_STATUT,
  TONS,
  TONS_PAR_DOMAINE,
  libelleStatut,
  tonStatut,
  type DomaineStatut,
} from '../../src/shared/utils/statuts';
import { LIBELLE_STATUT_PRESENCE } from '../../src/shared/utils/libelles';

const domaines = Object.keys(LIBELLES_STATUT) as DomaineStatut[];

describe('table des tons de statut', () => {
  it('couvre les mêmes domaines que les libellés', () => {
    expect(Object.keys(TONS_PAR_DOMAINE).sort()).toEqual([...domaines].sort());
  });

  it.each(domaines)('domaine « %s » : chaque statut libellé a un ton valide, et aucun ton orphelin', (domaine) => {
    const statuts = Object.keys(LIBELLES_STATUT[domaine]);
    const tons = TONS_PAR_DOMAINE[domaine];
    expect(statuts.length).toBeGreaterThan(0);
    for (const statut of statuts) {
      expect(TONS, `${domaine}.${statut}`).toContain(tons[statut]);
    }
    expect(Object.keys(tons).sort()).toEqual([...statuts].sort());
  });

  it('un statut inconnu ou absent reste neutre et garde son code', () => {
    expect(tonStatut('paiement', 'INCONNU')).toBe('neutre');
    expect(tonStatut('paiement', null)).toBe('neutre');
    expect(libelleStatut('paiement', 'INCONNU')).toBe('INCONNU');
    expect(libelleStatut('paiement', undefined)).toBe('—');
  });

  it('lit libellé et ton depuis les tables partagées', () => {
    expect(libelleStatut('paiement', 'REUSSI')).toBe('Payé');
    expect(tonStatut('paiement', 'REUSSI')).toBe('positif');
    expect(tonStatut('reclamation', 'REJETEE')).toBe('negatif');
    expect(tonStatut('courrier', 'ARCHIVE')).toBe('info');
  });

  it('chaque statut de présence contrôlé a son champ peint', () => {
    const statuts = Object.keys(LIBELLE_STATUT_PRESENCE).filter((s) => s !== 'NON_CONTROLE');
    expect(Object.keys(CLASSE_CHAMP_PRESENCE).sort()).toEqual(statuts.sort());
  });
});
