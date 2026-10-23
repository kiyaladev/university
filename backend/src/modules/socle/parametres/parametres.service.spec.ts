import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators';
import { ParametresController } from './parametres.controller';
import { ParametresService } from './parametres.service';

describe('ParametresService — règles de pointage minimales', () => {
  it('ne renvoie que l’exigence d’attestation au dialogue du contrôleur', async () => {
    const prisma: any = {
      parametre: { findUnique: jest.fn().mockResolvedValue({ cle: 'ATTESTATION_OBLIGATOIRE', valeur: 'false' }) },
    };
    const service = new ParametresService(prisma);

    await expect(service.reglesPointage()).resolves.toEqual([{ cle: 'ATTESTATION_OBLIGATOIRE', valeur: 'false' }]);
    expect(prisma.parametre.findUnique).toHaveBeenCalledTimes(1);
  });

  it('réserve la liste complète à ADMIN et limite la route utilisée au pointage', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ParametresController.prototype.liste)).toEqual([Role.ADMIN]);
    expect(Reflect.getMetadata(ROLES_KEY, ParametresController.prototype.reglesPointage)).toEqual([
      Role.ADMIN,
      Role.SCOLARITE,
      Role.DIRECTION,
      Role.CHEF_DEPARTEMENT,
      Role.CONTROLEUR,
      Role.ENSEIGNANT,
    ]);
  });

  it('trace les changements de règles dans la transaction et masque les valeurs non cataloguées', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const anciennesValeurs: Record<string, string> = {
      ABSENCE_APRES_MIN: '30',
      CLE_INCONNUE: 'ancien-secret',
    };
    const tx: any = {
      parametre: {
        findUnique: jest.fn(({ where }: any) =>
          Promise.resolve(
            anciennesValeurs[where.cle] === undefined ? null : { cle: where.cle, valeur: anciennesValeurs[where.cle] },
          ),
        ),
        upsert: jest.fn(({ where, create }: any) =>
          Promise.resolve({
            cle: where.cle,
            valeur: create.valeur,
          }),
        ),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      $transaction: jest.fn((operation) => operation(tx)),
      parametre: {
        findMany: jest.fn().mockResolvedValue([
          { cle: 'ABSENCE_APRES_MIN', valeur: '45' },
          { cle: 'CLE_INCONNUE', valeur: 'nouveau-secret' },
        ]),
      },
      auditLog: { create: jest.fn() },
    };
    const service = new ParametresService(prisma);

    await service.enregistrer(
      {
        parametres: [
          { cle: 'ABSENCE_APRES_MIN', valeur: '45' },
          { cle: 'CLE_INCONNUE', valeur: 'nouveau-secret', description: 'description privée' },
        ],
      },
      { id: 'admin-1' } as any,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(JSON.parse(auditCreate.mock.calls[0][0].data.details)).toMatchObject({
      cle: 'ABSENCE_APRES_MIN',
      avant: { valeur: '30' },
      apres: { valeur: '45' },
    });
    const inconnu = auditCreate.mock.calls[1][0].data;
    expect(inconnu).toMatchObject({ userId: 'admin-1', action: 'PARAMETRE_MODIFIE', entiteId: 'CLE_INCONNUE' });
    expect(inconnu.details).not.toContain('ancien-secret');
    expect(inconnu.details).not.toContain('nouveau-secret');
    expect(inconnu.details).not.toContain('description privée');
    expect(JSON.parse(inconnu.details)).toMatchObject({
      avant: { configure: true },
      apres: { configure: true },
    });
  });

  it('fait échouer la modification si le journal du paramètre ne peut pas être écrit', async () => {
    const tx: any = {
      parametre: {
        findUnique: jest.fn().mockResolvedValue({ cle: 'TOLERANCE_RETARD_MIN', valeur: '15' }),
        upsert: jest.fn().mockResolvedValue({ cle: 'TOLERANCE_RETARD_MIN', valeur: '20' }),
      },
      auditLog: { create: jest.fn().mockRejectedValue(new Error('audit indisponible')) },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new ParametresService(prisma);

    await expect(service.enregistrer({ parametres: [{ cle: 'TOLERANCE_RETARD_MIN', valeur: '20' }] })).rejects.toThrow(
      'audit indisponible',
    );
    expect(tx.parametre.upsert).toHaveBeenCalledTimes(1);
  });
});
