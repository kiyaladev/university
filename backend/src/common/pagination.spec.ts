import { paginer, pagine } from './pagination';

describe('paginer', () => {
  it('applique les valeurs par défaut (page 1, 50 lignes)', () => {
    expect(paginer({})).toEqual({ skip: 0, take: 50, page: 1, pageSize: 50, tout: false });
    expect(paginer()).toEqual({ skip: 0, take: 50, page: 1, pageSize: 50, tout: false });
  });

  it('calcule le décalage de la page demandée', () => {
    expect(paginer({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20, page: 3, pageSize: 20, tout: false });
  });

  it('accepte des paramètres encore sous forme de chaîne', () => {
    expect(paginer({ page: '2', pageSize: '10' })).toMatchObject({ skip: 10, take: 10, page: 2, pageSize: 10 });
  });

  it('borne pageSize entre 1 et 1000', () => {
    expect(paginer({ pageSize: 5000 }).pageSize).toBe(1000);
    expect(paginer({ pageSize: 0 }).pageSize).toBe(1);
  });

  it.each(['true', '1'])('all=%s lit la première tranche de 1000 lignes', (all) => {
    expect(paginer({ all, page: 4 })).toEqual({ skip: 0, take: 1000, page: 4, pageSize: 1000, tout: true });
  });

  it.each(['false', '0'])('all=%s reste paginé', (all) => {
    expect(paginer({ all }).tout).toBe(false);
  });

  it('all respecte un pageSize explicite', () => {
    expect(paginer({ all: 'true', pageSize: 10 })).toMatchObject({ skip: 0, take: 10, pageSize: 10, tout: true });
  });
});

describe('pagine', () => {
  it('renvoie la page et la taille demandées', () => {
    expect(pagine(['a'], 120, paginer({ page: 2, pageSize: 20 }))).toEqual({
      data: ['a'],
      total: 120,
      page: 2,
      pageSize: 20,
    });
  });

  it('en mode « tout », annonce page 1 et une taille plafonnée au total', () => {
    expect(pagine(['a', 'b'], 2, paginer({ all: 'true', page: 3 }))).toEqual({
      data: ['a', 'b'],
      total: 2,
      page: 1,
      pageSize: 2,
    });
    expect(pagine([], 5000, paginer({ all: '1' }))).toMatchObject({ page: 1, pageSize: 1000 });
  });
});
