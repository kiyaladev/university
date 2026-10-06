import { FicheService } from './fiche.service';

describe('FicheService — projection des relations', () => {
  it('ne charge pas les coordonnées, le QR ou les champs biométriques des personnes', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'travail-1',
      intitule: 'Mémoire',
      description: null,
      etudiantId: 'etu-1',
      encadrantId: null,
      etudiant: { id: 'etu-1', matricule: 'E-1', nom: 'Diallo', prenom: 'Awa' },
      encadrant: null,
      entreprise: null,
      tuteurEntreprise: null,
      lieu: null,
      dateDebut: null,
      dateFin: null,
      rapportRendu: false,
      statut: 'EN_COURS',
      soutenance: null,
    });
    const service = new FicheService(
      { travailEncadre: { findUnique } } as any,
      { valeur: jest.fn().mockResolvedValue('Université') } as any,
      { verify: jest.fn().mockReturnValue({}) } as any,
    );

    await service.fiche('travail-1', 'token-valide');

    const include = findUnique.mock.calls[0][0].include;
    expect(include.etudiant.select).toEqual({ id: true, matricule: true, nom: true, prenom: true });
    expect(include.encadrant.select).toEqual({ id: true, nom: true, prenom: true, grade: true });
    expect(include.soutenance.select.president).toEqual({ select: { id: true, nom: true, prenom: true } });
  });
});
