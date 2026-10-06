import { Role, StatutEnseignant } from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { EnseignantsService } from './enseignants';
import { MatieresService } from './matieres';
import { SallesService } from './salles';

describe('audit des mutations de référentiel', () => {
  it('journalise une matière sans copier de valeur hors instantané dans la même transaction', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const matiere = {
      id: 'matiere-1', code: 'INF101', intitule: 'Programmation',
      volumeHoraireTotal: 42, credits: 6, departementId: 'dept-1',
    };
    const tx: any = {
      matiere: { create: jest.fn().mockResolvedValue(matiere) },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new MatieresService(prisma);

    await service.creer(matiere as any, { id: 'admin-1', role: Role.ADMIN } as any);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.matiere.create).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'admin-1', action: 'MATIERE_CREEE', entite: 'Matiere', entiteId: 'matiere-1',
    }) });
    expect(JSON.parse(auditCreate.mock.calls[0][0].data.details).apres).toEqual(matiere);
  });

  it('journalise un changement de salle sans enregistrer le QR ni les coordonnées', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const avant = {
      id: 'salle-1', code: 'S204', nom: 'Salle privée', batiment: 'A', capacite: 30,
      actif: true, qrToken: 'UP-QR-SECRET', latitude: 9.5, longitude: -13.7, rayonMetres: 80,
    };
    const tx: any = {
      salle: {
        findUnique: jest.fn().mockResolvedValue(avant),
        update: jest.fn().mockResolvedValue({ ...avant, capacite: 35 }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new SallesService(prisma);

    await service.modifier('salle-1', { capacite: 35 }, { id: 'admin-1' } as any);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const details = auditCreate.mock.calls[0][0].data.details;
    expect(JSON.parse(details)).toMatchObject({
      avant: { id: 'salle-1', code: 'S204', capacite: 30, qrConfigure: true, coordonneesConfigurees: true },
      apres: { id: 'salle-1', code: 'S204', capacite: 35, qrConfigure: true, coordonneesConfigurees: true },
    });
    expect(details).not.toContain('UP-QR-SECRET');
    expect(details).not.toContain('9.5');
    expect(details).not.toContain('-13.7');
    expect(JSON.parse(details).avant).not.toHaveProperty('nom');
  });

  it('journalise un enseignant sans données personnelles, de rémunération, de PIN ou biométriques', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const avant = {
      id: 'enseignant-1', matricule: 'ENS-SECRET', nom: 'Nom privé', prenom: 'Prénom privé',
      statut: StatutEnseignant.PERMANENT, actif: true, departementId: 'dept-1', userId: 'user-1',
      email: 'prive@example.test', telephone: '+224600000000', tauxHoraire: 120,
      codePin: '$2a$pin-hash', empreinteTemplate: 'template-chiffre', empreinteDoigt: 'pouce',
    };
    const tx: any = {
      enseignant: {
        findUnique: jest.fn().mockResolvedValue(avant),
        update: jest.fn().mockResolvedValue({ ...avant, actif: false }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new EnseignantsService(prisma);
    const admin = { id: 'admin-1', role: Role.ADMIN, departementId: null } as AuthUser;

    await service.modifierPour('enseignant-1', { actif: false }, admin);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const details = auditCreate.mock.calls[0][0].data.details;
    expect(JSON.parse(details)).toMatchObject({
      avant: { id: 'enseignant-1', statut: 'PERMANENT', actif: true, departementId: 'dept-1', compteLie: true },
      apres: { id: 'enseignant-1', statut: 'PERMANENT', actif: false, departementId: 'dept-1', compteLie: true },
    });
    for (const secret of ['ENS-SECRET', 'Nom privé', 'Prénom privé', 'prive@example.test', '+224600000000', '120', '$2a$pin-hash', 'template-chiffre', 'pouce']) {
      expect(details).not.toContain(secret);
    }
  });

  it('revérifie le département du chef dans la transaction qui modifie la matière', async () => {
    const tx: any = {
      matiere: {
        findUnique: jest.fn().mockResolvedValue({ id: 'matiere-1', code: 'INF101', intitule: 'Algo', volumeHoraireTotal: 40, credits: 5, departementId: 'dept-2' }),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new MatieresService(prisma);

    await expect(service.modifier('matiere-1', { departementId: 'dept-1', credits: 6 }, {
      id: 'chef-1', role: Role.CHEF_DEPARTEMENT, departementId: 'dept-1',
    } as any)).rejects.toThrow();

    expect(tx.matiere.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
