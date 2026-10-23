import { ServiceUnavailableException } from '@nestjs/common';
import { DELAI_SONDE_BASE_MS, HealthController } from './health.controller';

describe('sonde /health', () => {
  afterEach(() => jest.useRealTimers());

  it('garde le même corps quand la base répond', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const reponse = await new HealthController(prisma as any).health();
    expect(reponse).toEqual({ status: 'ok', service: 'university-api', date: expect.any(String) });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('renvoie 503 quand la base est en panne', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('connexion refusée')) };
    await expect(new HealthController(prisma as any).health()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('renvoie 503 quand la base ne répond pas dans le délai', async () => {
    jest.useFakeTimers();
    const prisma = { $queryRaw: jest.fn(() => new Promise(() => undefined)) };
    const reponse = new HealthController(prisma as any).health();
    const verification = expect(reponse).rejects.toMatchObject({ status: 503 });
    jest.advanceTimersByTime(DELAI_SONDE_BASE_MS + 1);
    await verification;
  });
});
