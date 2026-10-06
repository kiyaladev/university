import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ScolariteService } from './scolarite.service';
import type { AuthUser } from '../../common/decorators';
import { I18nContext } from 'nestjs-i18n';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Périmètre départemental des résultats scolaires', () => {
  const chef = { role: Role.CHEF_DEPARTEMENT, departementId: 'dept' } as AuthUser;
  const scope = { promotion: { filiere: { departementId: 'dept' } } };
  const prepare = () => {
    const delegate = () => ({ findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) });
    const db: any = { evaluation: delegate(), note: delegate(), deliberation: delegate(), inscription: delegate() };
    db.$transaction = jest.fn((operation) => operation(db));
    return { db, service: new ScolariteService(db as any) };
  };
  it.each(['evaluations', 'notes', 'deliberations'])('filtre les %s et leur total malgré un identifiant tiers demandé', async type => {
    const { db, service } = prepare();
    if (type === 'evaluations') await service.listerEvaluations({ promotionId: 'foreign' } as any, chef);
    if (type === 'notes') await service.listerNotes({ evaluationId: 'foreign' } as any, chef);
    if (type === 'deliberations') await service.listerDeliberations({ anneeId: 'year' } as any, chef);
    const delegate = type === 'evaluations' ? db.evaluation : type === 'notes' ? db.note : db.deliberation;
    const where = delegate.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject(type === 'notes' ? { evaluation: scope, evaluationId: 'foreign' } : scope);
    expect(delegate.count).toHaveBeenCalledWith({ where });
  });
  it('refuse une saisie hors département avant de charger les étudiants ou écrire', async () => {
    const { db, service } = prepare();
    await expect(service.saisirNotes({ evaluationId: 'foreign', notes: [] }, chef)).rejects.toThrow(NotFoundException);
    expect(db.evaluation.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', ...scope } });
    expect(db.inscription.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
  it('un chef sans département ne reçoit aucun résultat global', async () => {
    const { db, service } = prepare();
    await service.listerEvaluations({} as any, { ...chef, departementId: null });
    expect(db.evaluation.findMany.mock.calls[0][0].where.promotion.filiere.departementId).toBe('__aucun_departement__');
  });
});
