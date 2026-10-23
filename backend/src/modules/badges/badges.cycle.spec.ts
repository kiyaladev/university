/**
 * Badges d'accès — numérotation, cycle de vie et vérification publique.
 *
 * Les règles sont en tête de `badges.service.ts` :
 *
 *   - le numéro est séquentiel par année civile (« BADGE-AAAA-NNNNN ») ;
 *   - la validité est plafonnée dans le temps : un badge dont la date est
 *     dépassée est EXPIRE, même si la base dit encore ACTIF ;
 *   - l'annulation est définitive : un badge annulé ne se modifie plus, ne
 *     se rallonge pas, et ne s'annule pas deux fois ;
 *   - la page de vérité ne s'ouvre que sur le couple identifiant + jeton
 *     exact, et sur un badge actif.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StatutBadge } from '@prisma/client';
import { BadgesService } from './badges.service';

const USER = { id: 'scolarite-1', nom: 'Scol', prenom: 'Arite', role: 'SCOLARITE' } as any;

/** Badge type, valide et encore actif. */
function badge(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'badge-1',
    numero: 'BADGE-2026-00001',
    type: 'VISITEUR',
    nom: 'SYLLAS',
    prenom: 'Ibrahima',
    fonction: 'Vendeur',
    organisation: 'Marché central',
    telephone: '622000000',
    email: 'syllas@example.gn',
    pieceIdentite: 'CNI-1234',
    numeroPiece: '1234',
    zonesAccess: 'A,B',
    photoUrl: null,
    qrToken: 'jeton-secret',
    motif: null,
    statut: StatutBadge.ACTIF,
    dateValidite: new Date('2030-01-01T00:00:00Z'),
    dateDelivrance: new Date('2026-01-01T00:00:00Z'),
    ...surcharge,
  };
}

/** Faux Prisma : transaction et delegates de lecture observables. */
function preparer(badgeCourant: Record<string, unknown> | null = badge()) {
  const tx: any = {
    badgeAcces: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(badgeCourant),
      create: jest.fn().mockResolvedValue(badge()),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...badge(), ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const prisma: any = {
    badgeAcces: {
      findUnique: jest.fn().mockResolvedValue(badgeCourant),
      findMany: jest.fn().mockResolvedValue(badgeCourant ? [badgeCourant] : []),
      count: jest.fn().mockResolvedValue(1),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((work) => work(tx)),
  };
  return { prisma, tx, service: new BadgesService(prisma, {} as any) };
}

describe('BadgesService — émission', () => {
  it('attribue un numéro séquentiel daté de l’année civile', async () => {
    const { tx, service } = preparer();
    tx.badgeAcces.findMany.mockResolvedValue([{ numero: 'BADGE-2026-00041' }]);

    await service.creer(
      { type: 'VISITEUR', nom: 'SYLLAS', prenom: 'Ibrahima', dateValidite: '2030-01-01' } as any,
      USER,
    );

    const annee = String(new Date().getFullYear());
    expect(tx.badgeAcces.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ numero: `BADGE-${annee}-00042`, statut: StatutBadge.ACTIF }),
      }),
    );
  });

  it('attribue un jeton QR unique et distinct du numéro', async () => {
    const { tx, service } = preparer();

    await service.creer({ type: 'VIP', nom: 'SYLLAS', prenom: 'Ibrahima', dateValidite: '2030-01-01' } as any, USER);

    const data = tx.badgeAcces.create.mock.calls[0][0].data;
    expect(data.qrToken).toMatch(/^UP-BADGE-/);
    expect(data.qrToken).not.toBe(data.numero);
  });

  it('journalise l’émission sans recopier l’identité du porteur', async () => {
    const { tx, service } = preparer();

    await service.creer(
      { type: 'VISITEUR', nom: 'SYLLAS', prenom: 'Ibrahima', dateValidite: '2030-01-01' } as any,
      USER,
    );

    const details = JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details);
    expect(details.apres).not.toHaveProperty('nom');
    expect(details.apres).not.toHaveProperty('telephone');
    expect(details.apres.qrConfigure).toBe(true);
  });

  it('réessaie sur un numéro déjà pris puis échoue après dix tentatives', async () => {
    const { tx, service } = preparer();
    tx.badgeAcces.create.mockRejectedValue(Object.assign(new Error('doublon'), { code: 'P2002' }));

    await expect(
      service.creer({ type: 'VISITEUR', nom: 'SYLLAS', prenom: 'Ibrahima', dateValidite: '2030-01-01' } as any, USER),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.badgeAcces.create).toHaveBeenCalledTimes(10);
  });
});

describe('BadgesService — statut effectif', () => {
  it('présente un badge périmé comme EXPIRE, même si la base dit encore ACTIF', async () => {
    const { service } = preparer(badge({ dateValidite: new Date('2020-01-01T00:00:00Z') }));

    const trouve = await service.trouver('badge-1');

    expect(trouve.statut).toBe(StatutBadge.EXPIRE);
  });

  it('ne requalifie jamais un badge annulé en expiré', async () => {
    const { service } = preparer(badge({ statut: StatutBadge.ANNULE, dateValidite: new Date('2020-01-01T00:00:00Z') }));

    const trouve = await service.trouver('badge-1');

    expect(trouve.statut).toBe(StatutBadge.ANNULE);
  });

  it('applique le statut effectif à toute la liste', async () => {
    const { prisma, service } = preparer(badge({ dateValidite: new Date('2020-01-01T00:00:00Z') }));

    const page = await service.liste({} as any);

    expect(page.data[0].statut).toBe(StatutBadge.EXPIRE);
    expect(prisma.badgeAcces.findMany).toHaveBeenCalled();
  });

  it('signale un badge introuvable', async () => {
    const { service } = preparer(null);

    await expect(service.trouver('badge-x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('BadgesService — modification et annulation', () => {
  it('refuse de modifier un badge annulé', async () => {
    const { tx, service } = preparer(badge({ statut: StatutBadge.ANNULE }));

    await expect(service.modifier('badge-1', { nom: 'NOUVEAU' } as any, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.badgeAcces.update).not.toHaveBeenCalled();
  });

  it('refuse d’annuler deux fois le même badge', async () => {
    const { tx, service } = preparer(badge({ statut: StatutBadge.ANNULE }));

    await expect(service.annuler('badge-1', { motif: 'Badge perdu' } as any, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.badgeAcces.update).not.toHaveBeenCalled();
  });

  it('annule un badge actif en consignant le motif', async () => {
    const { tx, service } = preparer(badge());

    await service.annuler('badge-1', { motif: 'Badge perdu' } as any, USER);

    expect(tx.badgeAcces.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: StatutBadge.ANNULE, motif: 'Badge perdu' }),
      }),
    );
  });
});

describe('BadgesService — rallongement de validité', () => {
  it('refuse une date de validité déjà dépassée', async () => {
    const { prisma, service } = preparer(badge());

    await expect(service.rallonger('badge-1', { dateValidite: '2020-01-01' } as any, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse de rallonger un badge annulé', async () => {
    const { tx, service } = preparer(badge({ statut: StatutBadge.ANNULE }));

    await expect(service.rallonger('badge-1', { dateValidite: '2031-01-01' } as any, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.badgeAcces.updateMany).not.toHaveBeenCalled();
  });

  it('remet le badge en actif et repousse sa date de validité', async () => {
    const { tx, service } = preparer(badge({ statut: StatutBadge.EXPIRE }));

    await service.rallonger('badge-1', { dateValidite: '2031-01-01' } as any, USER);

    expect(tx.badgeAcces.updateMany).toHaveBeenCalledWith({
      where: { id: 'badge-1', statut: StatutBadge.EXPIRE },
      data: { dateValidite: new Date('2031-01-01'), statut: StatutBadge.ACTIF },
    });
  });
});

describe('BadgesService — vérification publique', () => {
  it('refuse un identifiant inconnu et journalise l’échec', async () => {
    const { prisma, service } = preparer(null);

    const resultat = await service.verifier({ badge: 'badge-x', k: 'jeton-secret' } as any, '10.0.0.1');

    expect(resultat.valide).toBe(false);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'VERIF_BADGE_ECHEC', ip: '10.0.0.1' }),
      }),
    );
  });

  it('refuse un jeton qui ne correspond pas au badge présenté', async () => {
    const { prisma, service } = preparer(badge());

    const resultat = await service.verifier({ badge: 'badge-1', k: 'jeton-faux' } as any);

    expect(resultat.valide).toBe(false);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'VERIF_BADGE_ECHEC' }) }),
    );
  });

  it('refuse un badge annulé même avec le bon jeton', async () => {
    const { service } = preparer(badge({ statut: StatutBadge.ANNULE }));

    const resultat = await service.verifier({ badge: 'badge-1', k: 'jeton-secret' } as any);

    expect(resultat.valide).toBe(false);
    expect(resultat.raison).toContain('annulé');
  });

  it('refuse un badge périmé même avec le bon jeton', async () => {
    const { service } = preparer(badge({ dateValidite: new Date('2020-01-01T00:00:00Z') }));

    const resultat = await service.verifier({ badge: 'badge-1', k: 'jeton-secret' } as any);

    expect(resultat.valide).toBe(false);
    expect(resultat.raison).toContain('expirée');
  });

  it('accepte un badge actif présenté avec le bon jeton', async () => {
    const { prisma, service } = preparer(badge());

    const resultat = await service.verifier({ badge: 'badge-1', k: 'jeton-secret' } as any);

    expect(resultat.valide).toBe(true);
    expect((resultat as any).badge.porteur).toBe('Ibrahima SYLLAS');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'VERIF_BADGE_OK' }) }),
    );
  });

  it('ne publie ni le téléphone ni le coupon dans la page de vérité', async () => {
    const { service } = preparer(badge());

    const resultat = await service.verifier({ badge: 'badge-1', k: 'jeton-secret' } as any);

    expect((resultat as any).badge).not.toHaveProperty('telephone');
    expect((resultat as any).badge).not.toHaveProperty('email');
    expect((resultat as any).badge).not.toHaveProperty('qrToken');
    expect((resultat as any).badge).not.toHaveProperty('pieceIdentite');
  });
});

describe('BadgesService — modification', () => {
  it('réactive un badge périmé quand on repousse sa date de validité', async () => {
    const { tx, service } = preparer(
      badge({ statut: StatutBadge.EXPIRE, dateValidite: new Date('2020-01-01T00:00:00Z') }),
    );
    // La première écriture change les champs, la seconde recale le statut.
    tx.badgeAcces.update
      .mockResolvedValueOnce(badge({ statut: StatutBadge.EXPIRE, dateValidite: new Date('2031-01-01T00:00:00Z') }))
      .mockResolvedValueOnce(badge({ statut: StatutBadge.ACTIF, dateValidite: new Date('2031-01-01T00:00:00Z') }));

    const resultat = await service.modifier('badge-1', { dateValidite: '2031-01-01' } as any, USER);

    expect(tx.badgeAcces.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { statut: StatutBadge.ACTIF } }),
    );
    expect(resultat.statut).toBe(StatutBadge.ACTIF);
  });

  it('laisse un badge actif actif', async () => {
    const { tx, service } = preparer(badge());

    const resultat = await service.modifier('badge-1', { fonction: 'Enseignant' } as any, USER);

    expect(resultat.statut).toBe(StatutBadge.ACTIF);
    // Une seule écriture : le statut n'a pas bougé, inutile de le réécrire.
    expect(tx.badgeAcces.update).toHaveBeenCalledTimes(1);
    expect(tx.badgeAcces.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fonction: 'Enseignant' }) }),
    );
  });

  it('signale un badge introuvable à la modification', async () => {
    const { tx, service } = preparer(null);

    await expect(service.modifier('badge-x', { fonction: 'Enseignant' } as any, USER)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(tx.badgeAcces.update).not.toHaveBeenCalled();
  });
});
