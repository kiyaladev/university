/**
 * Journal d'audit du patrimoine — traces avant/après des mutations sensibles.
 *
 * Ce que ces tests verrouillent :
 *  - l'acteur (celui du compte connecté) et l'entité visée sont inscrits ;
 *  - l'état avant et après est complet sur les champs d'inventaire et d'état ;
 *  - ni jeton QR, ni observation libre, ni secret ne sont recopiés ;
 *  - la mutation et son entrée de journal partagent la transaction ;
 *  - une mutation refusée n'écrit rien, ni fiche ni trace.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { StatutReparation } from '@prisma/client';
import { PatrimoineService } from './patrimoine.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

const AGENT = { id: 'agent-1', nom: 'Barry', prenom: 'Mamadou' } as any;

const EQUIPEMENT = {
  id: 'eq-1',
  numeroInventaire: 'PAT-2026-00001',
  numeroSerie: 'SN-8842',
  libelle: 'Projecteur Dell',
  categorieId: 'cat-1',
  departementId: 'dep-1',
  salleId: 'salle-1',
  dateAcquisition: new Date('2024-02-10T00:00:00.000Z'),
  valeurAcquisition: 450000,
  qrCode: 'UP-PAT-jeton-confidentiel',
  actif: true,
  enReparation: false,
  obsolescenceMois: 60,
  notes: "Observation interne de l'agent",
};

/** Client transactionnel minimal : une écriture hors `tx` échoue le test. */
const transaction = (delegats: Record<string, any>, horsTransaction: Record<string, any> = {}) => {
  const tx: any = {
    ...delegats,
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'eq-1' }]),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = { ...horsTransaction, $transaction: jest.fn((operation: any) => operation(tx)) };
  return { tx, prisma, audit: tx.auditLog.create };
};

const lire = (audit: jest.Mock, index = 0) => JSON.parse(audit.mock.calls[index][0].data.details);

describe("Patrimoine — modification d'un équipement", () => {
  it("consigne l'acteur, l'entité et l'état avant/après dans la transaction", async () => {
    const avant = EQUIPEMENT;
    const apres = { ...EQUIPEMENT, libelle: 'Projecteur Epson', valeurAcquisition: 380000 };
    const { tx, prisma, audit } = transaction({
      equipementPatrimoine: {
        findUnique: jest.fn().mockResolvedValue(avant),
        update: jest.fn().mockResolvedValue(apres),
      },
    });
    const service = new PatrimoineService(prisma, {} as any);

    await service.modifierEquipement('eq-1', { libelle: 'Projecteur Epson', valeurAcquisition: 380000 } as any, AGENT);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.equipementPatrimoine.update).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0].data).toEqual({
      userId: 'agent-1',
      action: 'PATRIMOINE_EQUIPEMENT_MODIFIE',
      entite: 'EquipementPatrimoine',
      entiteId: 'eq-1',
      details: expect.any(String),
    });
    const details = lire(audit);
    expect(details.champsModifies).toEqual(['libelle', 'valeurAcquisition']);
    expect(details.avant.libelle).toBe('Projecteur Dell');
    expect(details.avant.valeurAcquisition).toBe(450000);
    expect(details.apres.libelle).toBe('Projecteur Epson');
    expect(details.apres.valeurAcquisition).toBe(380000);
    // Le reste de l'état d'inventaire reste lisible, inchangé.
    expect(details.avant.numeroInventaire).toBe('PAT-2026-00001');
    expect(details.apres.enReparation).toBe(false);
  });

  it('exclut le jeton QR, les notes et toute donnée de compte', async () => {
    const { prisma, audit } = transaction({
      equipementPatrimoine: {
        findUnique: jest.fn().mockResolvedValue(EQUIPEMENT),
        update: jest.fn().mockResolvedValue({ ...EQUIPEMENT, numeroInventaire: 'PAT-2026-00009' }),
      },
    });
    const service = new PatrimoineService(prisma, {} as any);

    await service.modifierEquipement('eq-1', { numeroInventaire: 'PAT-2026-00009' } as any, AGENT);

    const brut = audit.mock.calls[0][0].data.details;
    expect(brut).not.toContain('UP-PAT-jeton-confidentiel');
    expect(brut).not.toContain('Observation interne');
    expect(Object.keys(lire(audit).avant)).not.toContain('qrCode');
    expect(Object.keys(lire(audit).apres)).not.toContain('notes');
  });

  it("refuse la suppression d'un équipement réparé sans écrire ni fiche ni trace", async () => {
    const { tx, prisma, audit } = transaction({
      equipementPatrimoine: {
        findUnique: jest.fn().mockResolvedValue(EQUIPEMENT),
        delete: jest.fn(),
      },
      reparationMateriel: { count: jest.fn().mockResolvedValue(2) },
    });
    const service = new PatrimoineService(prisma, {} as any);

    await expect(service.supprimerEquipement('eq-1', AGENT)).rejects.toThrow(ConflictException);

    expect(tx.equipementPatrimoine.delete).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('trace la suppression autorisée avec un état après vide', async () => {
    const { prisma, audit } = transaction({
      equipementPatrimoine: {
        findUnique: jest.fn().mockResolvedValue(EQUIPEMENT),
        delete: jest.fn().mockResolvedValue({}),
      },
      reparationMateriel: { count: jest.fn().mockResolvedValue(0) },
    });
    const service = new PatrimoineService(prisma, {} as any);

    await expect(service.supprimerEquipement('eq-1', AGENT)).resolves.toEqual({ id: 'eq-1' });

    const details = lire(audit);
    expect(audit.mock.calls[0][0].data.action).toBe('PATRIMOINE_EQUIPEMENT_SUPPRIME');
    expect(details.avant.numeroInventaire).toBe('PAT-2026-00001');
    expect(details.apres).toBeNull();
  });

  it("n'inscrit rien quand la catégorie supprimée porte encore des équipements", async () => {
    const categorie = {
      id: 'cat-1',
      code: 'VIDEO',
      libelle: 'Audiovisuel',
      dureeAmortissement: 60,
      _count: { equipements: 3 },
    };
    const { tx, prisma, audit } = transaction({
      categoriePatrimoine: { findUnique: jest.fn().mockResolvedValue(categorie), delete: jest.fn() },
    });
    const service = new PatrimoineService(prisma, {} as any);

    await expect(service.supprimerCategorie('cat-1', AGENT)).rejects.toThrow(ConflictException);

    expect(tx.categoriePatrimoine.delete).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});

describe('Patrimoine — cycle des réparations', () => {
  it("déclare la réparation et bascule l'équipement dans la même transaction", async () => {
    const reparation = {
      id: 'rep-1',
      equipementId: 'eq-1',
      statut: StatutReparation.EN_COURS,
      cout: 75000,
      dateDeclaration: new Date('2026-10-01T09:00:00.000Z'),
      dateResolution: null,
      declareParId: 'agent-1',
      resoluParId: null,
      prestataire: 'Atelier Kankan',
      description: 'Lampe morte, interventionmedicale à prévoir',
      notes: null,
    };
    const { prisma, audit } = transaction({
      reparationMateriel: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(reparation),
      },
      equipementPatrimoine: {
        findUnique: jest.fn().mockResolvedValue(EQUIPEMENT),
        update: jest.fn().mockResolvedValue({ ...EQUIPEMENT, enReparation: true }),
      },
    });
    const service = new PatrimoineService(prisma, {} as any);

    await service.declarerReparation('eq-1', { description: 'Lampe morte' } as any, AGENT);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);
    const data = audit.mock.calls[0][0].data;
    expect(data.userId).toBe('agent-1');
    expect(data.action).toBe('PATRIMOINE_REPARATION_DECLAREE');
    expect(data.entite).toBe('ReparationMateriel');
    const details = lire(audit);
    expect(details.avant).toBeNull();
    expect(details.apres.statut).toBe(StatutReparation.EN_COURS);
    expect(details.apres.cout).toBe(75000);
    expect(details.equipementAvant.enReparation).toBe(false);
    expect(details.equipementApres.enReparation).toBe(true);
    // La description de la panne reste dans la fiche, pas dans le journal.
    expect(data.details).not.toContain('Lampe morte');
    expect(data.details).not.toContain('Atelier Kankan');
    expect(details.apres.prestataireFourni).toBe(true);
    expect(Object.keys(details.apres)).not.toContain('description');
  });

  it('ne déclare pas une seconde réparation et ne laisse aucune trace', async () => {
    const { tx, prisma, audit } = transaction({
      reparationMateriel: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'rep-0',
          statut: StatutReparation.EN_COURS,
        }),
        create: jest.fn(),
      },
      equipementPatrimoine: { findUnique: jest.fn().mockResolvedValue(EQUIPEMENT), update: jest.fn() },
    });
    const service = new PatrimoineService(prisma, {} as any);

    await expect(service.declarerReparation('eq-1', { description: 'Lampe morte' } as any, AGENT)).rejects.toThrow(
      ConflictException,
    );

    expect(tx.reparationMateriel.create).not.toHaveBeenCalled();
    expect(tx.equipementPatrimoine.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("clôture la réparation et libère l'équipement avec l'état des deux côtés", async () => {
    const ouverte = {
      id: 'rep-1',
      equipementId: 'eq-1',
      statut: StatutReparation.EN_COURS,
      cout: 75000,
      dateDeclaration: new Date('2026-10-01T09:00:00.000Z'),
      dateResolution: null,
      declareParId: 'agent-1',
      resoluParId: null,
      prestataire: null,
      notes: null,
    };
    const resolue = {
      ...ouverte,
      statut: StatutReparation.TERMINE,
      resoluParId: 'agent-2',
      dateResolution: new Date('2026-10-04T10:00:00.000Z'),
    };
    const { prisma, audit } = transaction({
      reparationMateriel: {
        findFirst: jest.fn().mockResolvedValue(ouverte),
        update: jest.fn().mockResolvedValue(resolue),
      },
      equipementPatrimoine: {
        findUnique: jest.fn().mockResolvedValue({ ...EQUIPEMENT, enReparation: true }),
        update: jest.fn().mockResolvedValue({ ...EQUIPEMENT, enReparation: false }),
      },
    });
    const service = new PatrimoineService(prisma, {} as any);

    await service.resoudreReparation(
      'eq-1',
      { noteResolution: 'Lampe remplacée' } as any,
      {
        id: 'agent-2',
        nom: 'Diallo',
        prenom: 'Aïssatou',
      } as any,
    );

    expect(audit).toHaveBeenCalledTimes(1);
    const data = audit.mock.calls[0][0].data;
    expect(data.action).toBe('PATRIMOINE_REPARATION_RESOLUE');
    const details = lire(audit);
    expect(details.avant.statut).toBe(StatutReparation.EN_COURS);
    expect(details.apres.statut).toBe(StatutReparation.TERMINE);
    expect(details.apres.resoluParId).toBe('agent-2');
    expect(details.equipementAvant.enReparation).toBe(true);
    expect(details.equipementApres.enReparation).toBe(false);
    expect(details.noteResolutionFournie).toBe(true);
    // La note d'intervention est un texte libre : sa présence suffit.
    expect(data.details).not.toContain('Lampe remplacée');
  });

  it('refuse de résoudre sans réparation ouverte et n’écrit rien', async () => {
    const { tx, prisma, audit } = transaction({
      reparationMateriel: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
      equipementPatrimoine: { findUnique: jest.fn().mockResolvedValue(EQUIPEMENT), update: jest.fn() },
    });
    const service = new PatrimoineService(prisma, {} as any);

    await expect(service.resoudreReparation('eq-1', {} as any, AGENT)).rejects.toThrow(BadRequestException);

    expect(tx.reparationMateriel.update).not.toHaveBeenCalled();
    expect(tx.equipementPatrimoine.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
