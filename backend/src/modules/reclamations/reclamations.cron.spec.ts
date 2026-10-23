/**
 * Escalade planifiée des réclamations : elle tourne hors requête HTTP, donc
 * sans utilisateur ni contexte i18n (I18nContext.current() vaut undefined).
 */
import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { Prisma, PrioriteReclamation, StatutReclamation, TypeReclamation } from '@prisma/client';
import { ReclamationsService } from './reclamations.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => undefined } }));

function preparer() {
  const tx = {
    reclamation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    reclamation: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'rec-1',
          numero: 'REC-2026-00001',
          creeLe: new Date('2026-10-01T08:00:00.000Z'),
          delaiEscaladeHeures: 48,
          type: TypeReclamation.INSCRIPTION,
          priorite: PrioriteReclamation.NORMALE,
          statut: StatutReclamation.OUVERT,
          anonyme: false,
          escaladeLe: null,
        },
      ]),
    },
    $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)),
  };
  return { prisma, tx, service: new ReclamationsService(prisma) };
}

describe('Escalade planifiée des réclamations', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-03T09:00:00.000Z'));
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('est déclarée comme tâche horaire auprès du ScheduleModule', () => {
    const options = Reflect.getMetadata(
      SCHEDULE_CRON_OPTIONS,
      ReclamationsService.prototype.escaladerReclamationsEchues,
    );
    expect(options).toMatchObject({ cronTime: CronExpression.EVERY_HOUR });
  });

  it('escalade les réclamations échues sans utilisateur et journalise sans compte', async () => {
    const { service, tx } = preparer();

    await expect(service.escaladerReclamationsEchues()).resolves.toEqual({
      escaladees: 1,
      numeros: ['REC-2026-00001'],
    });

    expect(tx.reclamation.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: null, action: 'RECLAMATION_ESCALADEE', entiteId: 'rec-1' }),
    });
    expect(JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details).origine).toBe('CRON');
  });

  it("consigne un conflit de sérialisation sans lever d'exception hors requête", async () => {
    const { service, prisma } = preparer();
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('serialization conflict', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );

    await expect(service.escaladerReclamationsEchues()).resolves.toBeNull();

    // Le message vient du catalogue français, pas d'un contexte i18n absent.
    expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('réessayez'));
  });

  it('garde la route manuelle attribuée au compte qui la déclenche', async () => {
    const { service, tx } = preparer();

    await service.cronEscalade({ id: 'admin-1' } as any);

    expect(tx.auditLog.create.mock.calls[0][0].data.userId).toBe('admin-1');
  });
});
