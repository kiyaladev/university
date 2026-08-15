/**
 * La limite de débit doit suivre l'adresse réelle, pas celle que le client
 * annonce : sinon un en-tête différent à chaque essai suffit à la contourner.
 */
import { DebitGuard } from './debit.guard';

class DebitGuardOuvert extends DebitGuard {
  public tracker(req: Record<string, any>) {
    return this.getTracker(req);
  }
}

describe('DebitGuard', () => {
  const garde = new DebitGuardOuvert({} as any, {} as any, {} as any);

  it('suit req.ip, calculé par Express derrière le proxy', async () => {
    // ips[0] est la valeur écrite par le client dans X-Forwarded-For.
    const req = { ip: '41.82.10.7', ips: ['1.2.3.4', '41.82.10.7'] };
    await expect(garde.tracker(req)).resolves.toBe('ip:41.82.10.7');
  });

  it('compte chaque session identifiée pour elle-même', async () => {
    const commun = { ip: '41.82.10.7' };
    const a = await garde.tracker({ ...commun, headers: { authorization: 'Bearer jeton-a' } });
    const b = await garde.tracker({ ...commun, headers: { authorization: 'Bearer jeton-b' } });

    // Deux contrôleurs derrière le même NAT ne doivent pas se gêner.
    expect(a).not.toBe(b);
    expect(a).not.toContain('jeton-a');
  });

  it('regroupe les requêtes d’une même session', async () => {
    const req = { ip: '41.82.10.7', headers: { authorization: 'Bearer jeton-a' } };
    const autre = { ip: '10.0.0.9', headers: { authorization: 'Bearer jeton-a' } };
    // Même session depuis un autre réseau : c'est toujours la même personne.
    await expect(garde.tracker(req)).resolves.toBe(await garde.tracker(autre));
  });

  it('ignore une adresse usurpée dans l’en-tête', async () => {
    // Le cas qui compte : la connexion, où aucun jeton n'est encore présenté.
    const premier = await garde.tracker({ ip: '41.82.10.7', ips: ['9.9.9.9'] });
    const second = await garde.tracker({ ip: '41.82.10.7', ips: ['8.8.8.8'] });
    expect(premier).toBe(second);
  });

  it('retombe sur la socket si req.ip manque', async () => {
    await expect(
      garde.tracker({ socket: { remoteAddress: '10.0.0.5' } }),
    ).resolves.toBe('ip:10.0.0.5');
  });
});
