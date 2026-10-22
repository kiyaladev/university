import { avantApres, journaliser } from './audit';

function client() {
  const create = jest.fn().mockResolvedValue({ id: 'log-1' });
  return { create, client: { auditLog: { create } } as any };
}

describe('journaliser', () => {
  const user = { id: 'u1' };

  it('écrit userId, action, entité et identifiant, details sérialisé en JSON', async () => {
    const { create, client: c } = client();
    await journaliser(c, user, 'ACTION', 'Entite', 'e1', { avant: null, apres: { a: 1 } });
    expect(create).toHaveBeenCalledWith({
      data: { userId: 'u1', action: 'ACTION', entite: 'Entite', entiteId: 'e1', details: '{"avant":null,"apres":{"a":1}}' },
    });
  });

  it("n'écrit pas details lorsqu'il est absent", async () => {
    const { create, client: c } = client();
    await journaliser(c, user, 'ACTION', 'Entite', 'e1');
    const data = create.mock.calls[0][0].data;
    expect(data).toEqual({ userId: 'u1', action: 'ACTION', entite: 'Entite', entiteId: 'e1' });
    expect('details' in data).toBe(false);
  });

  it('écrit une chaîne telle quelle', async () => {
    const { create, client: c } = client();
    await journaliser(c, user, 'ACTION', 'Entite', null, 'Motif libre');
    expect(create.mock.calls[0][0].data).toMatchObject({ entiteId: null, details: 'Motif libre' });
  });

  it("rattache la ligne à aucun compte sans utilisateur", async () => {
    const { create, client: c } = client();
    await journaliser(c, null, 'ACTION', 'Entite', 'e1', {});
    expect(create.mock.calls[0][0].data).toMatchObject({ userId: null, details: '{}' });
  });

  it('renvoie la promesse de create (utilisable dans $transaction([...]))', async () => {
    const { client: c } = client();
    await expect(journaliser(c, user, 'A', 'E', 'e')).resolves.toEqual({ id: 'log-1' });
  });
});

describe('avantApres', () => {
  it('garde l’ordre avant, apres puis le complément', () => {
    expect(JSON.stringify(avantApres(1, 2, { champsModifies: ['x'] }))).toBe('{"avant":1,"apres":2,"champsModifies":["x"]}');
    expect(avantApres(null, { a: 1 })).toEqual({ avant: null, apres: { a: 1 } });
  });
});
