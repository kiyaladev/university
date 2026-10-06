import { BadRequestException } from '@nestjs/common';
import { StadeTirage } from '@prisma/client';
import { TirageService } from './tirage.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Tirage lié à une année académique', () => {
  function preparer(anneeCloturee: boolean) {
    const tx: any = {
      examen: { findUnique: jest.fn().mockResolvedValue({ id: 'exam-1', codeExamen: 'EX-01', anneeId: 'annee-1' }) },
      tirage: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tirage-1', stade: StadeTirage.PROGRAMME, empreinteSource: 'abc123', nbExemplaires: 10,
          examen: { id: 'exam-1', codeExamen: 'EX-01', intitule: 'Partiel', anneeId: 'annee-1', annee: { id: 'annee-1' } },
        }),
        create: jest.fn(), update: jest.fn(),
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

    await expect(service.creer({
      examenId: 'exam-1', dateTirage: '2026-09-01', nbExemplaires: 10,
      empreinteSource: 'abc123',
    } as any, { id: 'agent-1' } as any)).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    expect(tx.tirage.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse une transition de tirage close avant toute mutation', async () => {
    const { tx, service } = preparer(true);

    await expect(service.imprimer('tirage-1', { empreinteSource: 'abc123' } as any, { id: 'agent-1' } as any))
      .rejects.toThrow(BadRequestException);

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
    await expect((service as any)[method]('tirage-1', { stade }, { id: 'agent' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.tirage.update).not.toHaveBeenCalled();
  });

  it('refuse une impression dont l’état a changé pendant l’acquisition du verrou', async () => {
    const { tx, service } = preparer(false);
    const initial = await tx.tirage.findUnique();
    tx.tirage.findUnique.mockResolvedValueOnce(initial).mockResolvedValueOnce({ ...initial, stade: StadeTirage.IMPRIME });
    await expect(service.imprimer('tirage-1', { empreinteSource: 'abc123' }, { id: 'agent' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$queryRaw.mock.calls.some(args => args[0].join('?').includes('FOR UPDATE'))).toBe(true);
    expect(tx.tirage.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
