import { BadRequestException } from '@nestjs/common';
import { ScolariteService } from './scolarite.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (k: string) => k }) } }));

describe('Gel concurrent du jury', () => {
  it.each(['calculer', 'valider'])(
    '%s relit la décision après le verrou et refuse un jury devenu validé',
    async (operation) => {
      const tx: any = {
        $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false, id: 'jury' }]),
        deliberation: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({ id: 'jury', anneeId: 'year', statut: 'BROUILLON' })
            .mockResolvedValueOnce({ id: 'jury', anneeId: 'year', statut: 'VALIDE' }),
          update: jest.fn(),
        },
        deliberationLigne: { upsert: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      const db: any = { $transaction: jest.fn((fn: any) => fn(tx)) };
      const service = new ScolariteService(db);
      const promise =
        operation === 'calculer' ? service.calculerDeliberation('jury') : service.validerDeliberation('jury', 'admin');
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR SHARE');
      expect(tx.$queryRaw.mock.calls[1][0].join('?')).toContain('FOR UPDATE');
      expect(tx.deliberation.findUnique.mock.invocationCallOrder[1]).toBeGreaterThan(
        tx.$queryRaw.mock.invocationCallOrder[1],
      );
      expect(tx.deliberation.update).not.toHaveBeenCalled();
      expect(tx.deliberationLigne.upsert).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    },
  );
});
