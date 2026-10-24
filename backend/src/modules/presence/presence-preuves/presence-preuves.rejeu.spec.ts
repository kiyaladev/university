/**
 * Anti-rejeu des preuves biométriques : une preuve consommée ne peut plus
 * servir, deux lectures distinctes restent acceptées, et le registre se purge
 * une fois la fenêtre d'acceptation passée.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AttestationMode, Prisma } from '@prisma/client';
import { createHash, createHmac } from 'node:crypto';
import { PresencePreuvesService } from './presence-preuves.service';

const SECRET = 'secret-partage-de-test';
const SECRET_APPAREIL = 'cle-propre-au-poste';
process.env.BIOMETRIE_SECRET = SECRET;

const GABARIT = 'SIMU-ENS-001';
const empreinteGabarit = createHash('sha256').update(GABARIT).digest('hex');

function signer(charge: string, secret = SECRET) {
  return createHmac('sha256', secret).update(charge).digest('hex');
}

/** Charge signée par la passerelle, comme dans `biometrie/src/signature.ts`. */
function chargeVerification(params: {
  appareilId?: string | null;
  enseignantId?: string;
  score: number;
  horodatage: string;
  tentativeId?: string | null;
}) {
  const base = params.appareilId
    ? `verification|${params.appareilId}|${params.enseignantId ?? 'ens-1'}|${empreinteGabarit}|${params.score}`
    : `verification|${params.enseignantId ?? 'ens-1'}|${empreinteGabarit}|${params.score}`;
  if (!params.tentativeId) return `${base}|${params.horodatage}`;
  return `${base}|${params.horodatage}|${params.tentativeId}`;
}

/** Service avec un registre simulé : l'unicité de la clé est respectée. */
function preparer() {
  const registre = new Map<string, any>();
  const prisma: any = {
    enseignant: {
      findUnique: jest.fn().mockResolvedValue({ id: 'ens-1', empreinteTemplate: GABARIT }),
    },
    appareil: {
      findUnique: jest.fn().mockResolvedValue({ id: 'appareil-1', secret: SECRET_APPAREIL, actif: true }),
      update: jest.fn().mockResolvedValue({}),
    },
    preuveConsommee: {
      create: jest.fn(async ({ data }: any) => {
        if (registre.has(data.cle)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '6.19.3',
          });
        }
        registre.set(data.cle, data);
        return data;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        let count = 0;
        for (const [cle, ligne] of registre) {
          if (ligne.expireLe.getTime() < where.expireLe.lt.getTime()) {
            registre.delete(cle);
            count += 1;
          }
        }
        return { count };
      }),
    },
  };
  prisma.$transaction = jest.fn(async (operation: (tx: any) => unknown) => operation(prisma));

  const parametres = {
    nombre: jest.fn(async (_cle: string, defaut: number) => defaut),
    booleen: jest.fn(async (_cle: string, defaut: boolean) => defaut),
  } as any;

  return { service: new PresencePreuvesService(prisma, parametres), prisma, registre };
}

/** Preuve signée par la passerelle, sur le poste enrôlé. */
function preuve(params: { score?: number; horodatage: string; tentativeId?: string }) {
  const score = params.score ?? 88;
  return {
    score,
    horodatage: params.horodatage,
    signature: signer(
      chargeVerification({
        appareilId: 'appareil-1',
        score,
        horodatage: params.horodatage,
        tentativeId: params.tentativeId,
      }),
      SECRET_APPAREIL,
    ),
    appareilId: 'appareil-1',
    ...(params.tentativeId ? { tentativeId: params.tentativeId } : {}),
  };
}

describe('Anti-rejeu — registre des preuves consommées', () => {
  it('refuse une preuve déjà consommée (409)', async () => {
    const { service, registre } = preparer();
    const h = new Date().toISOString();
    const p = preuve({ horodatage: h });

    await expect(service.verifierPreuves('ens-1', { empreinte: p })).resolves.toMatchObject({
      mode: AttestationMode.EMPREINTE,
      valide: true,
    });
    expect(registre.size).toBe(1);

    // La même preuve, rejouée à l'identique : elle ne vaut plus rien.
    await expect(service.verifierPreuves('ens-1', { empreinte: p })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.verifierPreuves('ens-1', { empreinte: p })).rejects.toThrow(/déjà utilisée/);
    expect(registre.size).toBe(1);
  });

  it('accepte deux lectures distinctes', async () => {
    const { service, registre } = preparer();
    const premiere = preuve({ horodatage: new Date().toISOString(), score: 88 });
    const seconde = preuve({ horodatage: new Date(Date.now() + 1000).toISOString(), score: 91 });

    await expect(service.verifierPreuves('ens-1', { empreinte: premiere })).resolves.toMatchObject({ valide: true });
    await expect(service.verifierPreuves('ens-1', { empreinte: seconde })).resolves.toMatchObject({ valide: true });

    expect(registre.size).toBe(2);
  });

  it('n’inscrit rien quand la preuve est refusée', async () => {
    const { service, registre } = preparer();
    const h = new Date().toISOString();

    // Score trop bas : la preuve n'est pas consommée.
    await expect(
      service.verifierPreuves('ens-1', { empreinte: preuve({ horodatage: h, score: 20 }) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Preuve périmée : elle non plus.
    const vieux = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await expect(service.verifierPreuves('ens-1', { empreinte: preuve({ horodatage: vieux }) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // Signature forgée : refusée avant toute inscription.
    await expect(
      service.verifierPreuves('ens-1', {
        empreinte: { score: 90, horodatage: h, signature: 'faux', appareilId: 'appareil-1' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(registre.size).toBe(0);
  });

  it('inscrit la consommation dans la transaction du pointage', async () => {
    const { service, prisma } = preparer();
    const tx: any = { preuveConsommee: { create: jest.fn().mockResolvedValue({}) } };

    await service.verifierPreuves('ens-1', { empreinte: preuve({ horodatage: new Date().toISOString() }) }, tx);

    expect(tx.preuveConsommee.create).toHaveBeenCalledTimes(1);
    expect(prisma.preuveConsommee.create).not.toHaveBeenCalled();
  });

  it('conserve la trace de la preuve sans biométrie', async () => {
    const { service, registre } = preparer();
    const h = new Date().toISOString();
    await service.verifierPreuves('ens-1', { empreinte: preuve({ horodatage: h }) });

    const [ligne] = [...registre.values()];
    expect(ligne).toMatchObject({ enseignantId: 'ens-1', appareilId: 'appareil-1', score: 88 });
    expect(ligne.cle).toMatch(/^signature:[0-9a-f]{64}$/);
    expect(JSON.stringify(ligne)).not.toContain(GABARIT);
    expect(ligne.expireLe.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('Anti-rejeu — nonce de tentative', () => {
  it('utilise le nonce signé par la passerelle pour identifier la preuve', async () => {
    const { service, registre } = preparer();
    const tentativeId = 'tentative-2026-10-24-001';
    const h = new Date().toISOString();

    await service.verifierPreuves('ens-1', { empreinte: preuve({ horodatage: h, tentativeId }) });

    expect([...registre.keys()]).toEqual([`nonce:${tentativeId}`]);
  });

  it('refuse la relecture d’une même tentative, même avec une nouvelle signature', async () => {
    const { service } = preparer();
    const tentativeId = 'tentative-2026-10-24-002';
    const premiere = preuve({ horodatage: new Date().toISOString(), tentativeId });
    const seconde = preuve({ horodatage: new Date(Date.now() + 1000).toISOString(), tentativeId });

    await expect(service.verifierPreuves('ens-1', { empreinte: premiere })).resolves.toMatchObject({ valide: true });
    await expect(service.verifierPreuves('ens-1', { empreinte: seconde })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuse une preuve dont le nonce a été changé', async () => {
    const { service, registre } = preparer();
    const h = new Date().toISOString();
    const preuveSignee = preuve({ horodatage: h, tentativeId: 'tentative-originale' });

    await expect(
      service.verifierPreuves('ens-1', { empreinte: { ...preuveSignee, tentativeId: 'tentative-volée' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(registre.size).toBe(0);
  });

  it('accepte une passerelle ancienne, qui ne signe pas le nonce', async () => {
    const { service, registre } = preparer();
    const h = new Date().toISOString();
    // Charge signée sans le nonce : la passerelle d'avant.
    const p = preuve({ horodatage: h });

    await expect(
      service.verifierPreuves('ens-1', { empreinte: { ...p, tentativeId: 'tentative-ignoree' } }),
    ).resolves.toMatchObject({ valide: true });

    // Sans nonce signé, c'est la signature qui identifie la preuve.
    expect([...registre.keys()][0]).toMatch(/^signature:[0-9a-f]{64}$/);
  });
});

describe('Anti-rejeu — purge du registre', () => {
  it('purge les entrées plus vieilles que la fenêtre', async () => {
    const { service, prisma, registre } = preparer();
    const maintenant = Date.now();

    registre.set('signature:ancienne', {
      cle: 'signature:ancienne',
      expireLe: new Date(maintenant - 60_000),
    });
    registre.set('signature:recente', {
      cle: 'signature:recente',
      expireLe: new Date(maintenant + 5 * 60 * 1000),
    });

    await expect(service.purgerPreuvesConsommees()).resolves.toEqual({ purges: 1 });

    expect(prisma.preuveConsommee.deleteMany).toHaveBeenCalledWith({
      where: { expireLe: { lt: expect.any(Date) } },
    });
    expect([...registre.keys()]).toEqual(['signature:recente']);
  });

  it('ne purge rien quand le registre est vide', async () => {
    const { service } = preparer();
    await expect(service.purgerPreuvesConsommees()).resolves.toEqual({ purges: 0 });
  });
});
