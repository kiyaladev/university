import { UsersService } from './users';

const compte = {
  id: 'user-cible',
  email: 'cible@example.test',
  nom: 'Nom privé',
  prenom: 'Prénom privé',
  telephone: '+224600000000',
  role: 'ENSEIGNANT',
  actif: true,
  departementId: 'dept-1',
  password: '$2a$secret-hash',
  tentativesEchouees: 4,
  verrouilleJusqua: new Date('2026-10-03T12:00:00Z'),
  motDePasseModifieLe: new Date('2026-09-01T00:00:00Z'),
};

describe('audit des mutations de comptes utilisateurs', () => {
  it('journalise création et rattachement enseignant dans la même transaction, sans identité ni hash', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx: any = {
      user: { create: jest.fn().mockResolvedValue(compte) },
      enseignant: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new UsersService(prisma);

    await service.creer(
      {
        email: 'Cible@Example.Test',
        password: 'Secret@2026',
        nom: 'Nom privé',
        prenom: 'Prénom privé',
        telephone: '+224600000000',
        role: 'ENSEIGNANT' as any,
        departementId: 'dept-1',
        enseignantId: 'enseignant-1',
      },
      { id: 'admin-1' } as any,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.enseignant.update).toHaveBeenCalledWith({
      where: { id: 'enseignant-1' },
      data: { userId: 'user-cible' },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'UTILISATEUR_CREE',
        entite: 'Utilisateur',
        entiteId: 'user-cible',
      }),
    });
    const details = auditCreate.mock.calls[0][0].data.details;
    expect(JSON.parse(details)).toMatchObject({
      avant: null,
      apres: { id: 'user-cible', role: 'ENSEIGNANT', actif: true, departementId: 'dept-1', motDePasseConfigure: true },
    });
    for (const secret of [
      'Secret@2026',
      '$2a$secret-hash',
      'cible@example.test',
      'Nom privé',
      'Prénom privé',
      '+224600000000',
    ]) {
      expect(details).not.toContain(secret);
    }
  });

  it('journalise la suppression avec un instantané réduit, au sein de la transaction', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(compte),
        delete: jest.fn().mockResolvedValue({ id: compte.id }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new UsersService(prisma);

    await expect(service.supprimer(compte.id, { id: 'admin-1' } as any)).resolves.toEqual({ id: compte.id });

    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: compte.id } });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'UTILISATEUR_SUPPRIME',
        entiteId: compte.id,
      }),
    });
    const details = auditCreate.mock.calls[0][0].data.details;
    expect(JSON.parse(details).avant).toEqual({
      id: compte.id,
      role: 'ENSEIGNANT',
      actif: true,
      departementId: 'dept-1',
      motDePasseConfigure: true,
    });
    for (const secret of ['$2a$secret-hash', 'cible@example.test', '+224600000000', 'Nom privé']) {
      expect(details).not.toContain(secret);
    }
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('fait échouer la modification si la trace ne peut pas être écrite', async () => {
    const tx: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(compte),
        update: jest.fn().mockResolvedValue({ ...compte, actif: false }),
      },
      auditLog: { create: jest.fn().mockRejectedValue(new Error('audit indisponible')) },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new UsersService(prisma);

    await expect(service.modifier(compte.id, { actif: false } as any, { id: 'admin-1' } as any)).rejects.toThrow(
      'audit indisponible',
    );
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
