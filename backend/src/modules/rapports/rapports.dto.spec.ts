import { Role } from '@prisma/client';
import { perimetrePresence } from './rapports.dto';

describe('Périmètre des rapports et exports', () => {
  it('impose l’identité enseignant malgré un filtre tiers', () => {
    expect(perimetrePresence({ enseignantId: 'other' }, { role: Role.ENSEIGNANT, enseignantId: 'own' } as any))
      .toEqual({ enseignantId: 'own' });
  });
  it('impose le département du chef', () => {
    expect(perimetrePresence({ departementId: 'other' }, { role: Role.CHEF_DEPARTEMENT, departementId: 'own' } as any))
      .toEqual({ departementId: 'own' });
  });
  it('impose le département du contrôleur même si le filtre URL vise un autre département', () => {
    expect(perimetrePresence({ departementId: 'other' }, { role: Role.CONTROLEUR, departementId: 'own' } as any))
      .toEqual({ departementId: 'own' });
  });
  it('refuse un périmètre de contrôleur manquant', () => {
    expect(perimetrePresence({}, { role: Role.CONTROLEUR, departementId: null } as any))
      .toEqual({ departementId: '__aucun__' });
  });
  it('ne donne aucun périmètre au profil incomplet', () => {
    expect(perimetrePresence({}, { role: Role.ENSEIGNANT, enseignantId: null } as any))
      .toEqual({ enseignantId: '__aucun__' });
  });
});
