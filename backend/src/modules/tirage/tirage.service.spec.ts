import { BadRequestException } from '@nestjs/common';
import { StadeTirage } from '@prisma/client';
import { masquerEmpreinte, TirageService } from './tirage.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Tirage lié à une année académique', () => {
  function preparer(anneeCloturee: boolean) {
    const tx: any = {
      examen: { findUnique: jest.fn().mockResolvedValue({ id: 'exam-1', codeExamen: 'EX-01', anneeId: 'annee-1' }) },
      tirage: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tirage-1',
          stade: StadeTirage.PROGRAMME,
          empreinteSource: 'abc123',
          nbExemplaires: 10,
          examen: {
            id: 'exam-1',
            codeExamen: 'EX-01',
            intitule: 'Partiel',
            anneeId: 'annee-1',
            annee: { id: 'annee-1' },
          },
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: anneeCloturee }) },
      $queryRaw: jest.fn().mockResolvedValue([{ cloturee: anneeCloturee }]),
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((work) => work(tx)) };
    return { prisma, tx, service: new TirageService(prisma) };
  }

  it('refuse de créer un tirage rattaché à un examen d’année clôturée', async () => {
    const { prisma, tx, service } = preparer(true);

    await expect(
      service.creer(
        {
          examenId: 'exam-1',
          dateTirage: '2026-09-01',
          nbExemplaires: 10,
          empreinteSource: 'abc123',
        } as any,
        { id: 'agent-1' } as any,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    expect(tx.tirage.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse une transition de tirage close avant toute mutation', async () => {
    const { tx, service } = preparer(true);

    await expect(
      service.imprimer('tirage-1', { empreinteSource: 'abc123' } as any, { id: 'agent-1' } as any),
    ).rejects.toThrow(BadRequestException);

    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    expect(tx.tirage.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ['mettreSousPli', StadeTirage.IMPRIME],
    ['distribuer', StadeTirage.MIS_SOUS_PLI],
    ['recuperer', StadeTirage.DISTRIBUE],
  ])('refuse le stade %s/%s pour contourner le contrôle de son endpoint', async (method, stade) => {
    const { prisma, tx, service } = preparer(false);
    await expect((service as any)[method]('tirage-1', { stade }, { id: 'agent' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.tirage.update).not.toHaveBeenCalled();
  });

  it('refuse une impression dont l’état a changé pendant l’acquisition du verrou', async () => {
    const { tx, service } = preparer(false);
    const initial = await tx.tirage.findUnique();
    tx.tirage.findUnique
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce({ ...initial, stade: StadeTirage.IMPRIME });
    await expect(
      service.imprimer('tirage-1', { empreinteSource: 'abc123' }, { id: 'agent' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$queryRaw.mock.calls.some((args) => args[0].join('?').includes('FOR UPDATE'))).toBe(true);
    expect(tx.tirage.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('Tirage — contrôle anti-substitution à l’impression', () => {
  const ATTENDUE = 'a'.repeat(64);

  function preparer() {
    const tirage = {
      id: 'tirage-1',
      stade: StadeTirage.PROGRAMME,
      empreinteSource: ATTENDUE,
      nbExemplaires: 10,
      dateTirage: new Date('2026-09-01'),
      empreinteExemplaires: null,
      imprimeur: null,
      examen: {
        id: 'exam-1',
        codeExamen: 'EX-01',
        intitule: 'Partiel',
        anneeId: 'annee-1',
        dateExamen: new Date('2026-09-02'),
        annee: { id: 'annee-1', libelle: '2026-2027' },
        promotion: { nom: 'L1' },
        matiere: { intitule: 'Algèbre' },
        salle: null,
        surveillant: null,
      },
    };
    const tx: any = {
      tirage: {
        findUnique: jest.fn().mockResolvedValue(tirage),
        update: jest.fn().mockResolvedValue({ ...tirage, stade: StadeTirage.IMPRIME }),
      },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false }]),
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn((work) => work(tx)),
      tirage: {
        findUnique: jest.fn().mockResolvedValue(tirage),
        findMany: jest.fn().mockResolvedValue([tirage]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    return { prisma, tx, service: new TirageService(prisma) };
  }

  it('refuse une empreinte différente de celle du sujet validé, sans rien écrire', async () => {
    const { tx, service } = preparer();
    await expect(
      service.imprimer('tirage-1', { empreinteSource: 'b'.repeat(64) }, { id: 'agent' } as any),
    ).rejects.toThrow('tirage.empreinte_source_fournie_ne_correspond_pas_a_celle_enregistr');
    expect(tx.tirage.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse le préfixe exposé à la place de l’empreinte complète', async () => {
    const { tx, service } = preparer();
    const { empreinteSource: prefixe } = await service.trouver('tirage-1');
    await expect(
      service.imprimer('tirage-1', { empreinteSource: prefixe }, { id: 'agent' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.tirage.update).not.toHaveBeenCalled();
  });

  it('accepte l’empreinte exacte, quelle que soit la casse', async () => {
    const { tx, service } = preparer();
    await service.imprimer('tirage-1', { empreinteSource: ATTENDUE.toUpperCase() }, { id: 'agent' } as any);
    expect(tx.tirage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stade: StadeTirage.IMPRIME, imprimeurId: 'agent' }),
      }),
    );
  });

  it('n’expose pas l’empreinte attendue d’un tirage programmé (liste, fiche, bordereau)', async () => {
    const { service } = preparer();
    const page = await service.liste({} as any);
    const fiche = await service.trouver('tirage-1');
    const html = await service.imprimerBordereau('tirage-1');
    expect(page.data[0].empreinteSource).not.toContain(ATTENDUE);
    expect(fiche.empreinteSource.length).toBeLessThan(64);
    expect(html).toContain('EX-01');
    expect(html).not.toContain(ATTENDUE);
  });

  it('révèle l’empreinte complète une fois le tirage imprimé', () => {
    const imprime = { stade: StadeTirage.IMPRIME, empreinteSource: ATTENDUE };
    expect(masquerEmpreinte(imprime).empreinteSource).toBe(ATTENDUE);
  });
});
