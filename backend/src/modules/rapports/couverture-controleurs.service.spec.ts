import { RapportsService } from './rapports.service';

describe('Couverture des tournées contrôleurs', () => {
  it('distingue séances visitées, manquées et couvertes par un collègue', async () => {
    const service = new RapportsService({} as any);
    const hier = new Date(Date.now() - 86_400_000);
    const demain = new Date(Date.now() + 86_400_000);
    jest.spyOn(service as any, 'seances').mockResolvedValue([
      {
        date: hier,
        controleurAssigne: { id: 'ctrl-1', nom: 'Diallo', prenom: 'Aminata' },
        controle: { controleurId: 'ctrl-1' },
      },
      { date: hier, controleurAssigne: { id: 'ctrl-1', nom: 'Diallo', prenom: 'Aminata' }, controle: null },
      {
        date: hier,
        controleurAssigne: { id: 'ctrl-1', nom: 'Diallo', prenom: 'Aminata' },
        controle: { controleurId: 'ctrl-2' },
      },
      { date: demain, controleurAssigne: { id: 'ctrl-1', nom: 'Diallo', prenom: 'Aminata' }, controle: null },
      { date: hier, controleurAssigne: null, controle: null },
    ] as any);

    const resultat = await service.couvertureControleurs({ dateDebut: '2026-10-01', dateFin: '2026-10-04' });

    expect(resultat.lignes).toEqual([
      expect.objectContaining({
        controleurId: 'ctrl-1',
        seancesPlanifiees: 4,
        seancesPassees: 3,
        visitees: 2,
        nonVisitees: 1,
        realiseesParAssigne: 1,
        realiseesParUnAutre: 1,
        tauxCouverture: 66.67,
        tauxParAssigne: 33.33,
      }),
    ]);
    expect(resultat.nonAffectees).toEqual(expect.objectContaining({ seancesPassees: 1, nonVisitees: 1 }));
  });
});
