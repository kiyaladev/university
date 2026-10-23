import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { StatutFormation, StatutInscriptionFormation, StatutPaiement } from '@prisma/client';
import { FORMATION_PUBLIQUE_SELECT, INSCRIPTION_FORMATION_INCLUDE, FormationsService } from './formations.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Vitrine publique des formations', () => {
  it('revérifie la capacité sous verrou avant de créer une inscription publique', async () => {
    const formation = {
      id: 'formation-1',
      titre: 'Gestion',
      prix: 100,
      devise: 'GNF',
      capacite: 2,
      statut: StatutFormation.PUBLIEE,
    };
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: formation.id, statut: formation.statut, capacite: 2 }]),
      formation: { findUnique: jest.fn().mockResolvedValue(formation) },
      inscriptionFormation: { count: jest.fn().mockResolvedValue(2), create: jest.fn() },
      paiement: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      formation: { findUnique: jest.fn().mockResolvedValue(formation) },
      etudiant: { findUnique: jest.fn() },
      inscriptionFormation: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)),
    };
    const service = new FormationsService(prisma, {} as any, {} as any);

    await expect(
      service.inscriptionPublique('formation-1', {
        nomComplet: 'A. Test',
        telephone: '+224600000000',
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.$queryRaw.mock.calls[0][0].join(' ')).toContain('FOR UPDATE');
    expect(tx.paiement.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('limite le détail public aux champs de la vitrine', async () => {
    const publicFields = {
      id: 'formation-1',
      titre: 'Gestion de projet',
      description: 'Formation ouverte',
      categorie: 'Gestion',
      prix: 250000,
      devise: 'GNF',
      dureeHeures: 12,
      dateDebut: new Date('2026-11-01T00:00:00Z'),
      dateFin: new Date('2026-11-02T00:00:00Z'),
      lieu: 'Campus',
      capacite: 20,
      statut: StatutFormation.PUBLIEE,
    };
    const prisma = {
      formation: { findUnique: jest.fn().mockResolvedValue(publicFields) },
      inscriptionFormation: { count: jest.fn().mockResolvedValue(7) },
    };
    const service = new FormationsService(prisma as any, {} as any, {} as any);

    const result = await service.formationPublique('formation-1');

    expect(prisma.formation.findUnique).toHaveBeenCalledWith({
      where: { id: 'formation-1' },
      select: FORMATION_PUBLIQUE_SELECT,
    });
    expect(result).toEqual({ ...publicFields, inscrits: 7, placesRestantes: 13 });
    expect(result).not.toHaveProperty('creeParId');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
  });

  it('écrit la formation et son état avant/après dans la même transaction', async () => {
    const formation = {
      id: 'formation-1',
      titre: 'Gestion de projet',
      prix: 250000,
      devise: 'GNF',
      statut: StatutFormation.BROUILLON,
      dateDebut: null,
      dateFin: null,
      capacite: 20,
    };
    const tx = {
      formation: { create: jest.fn().mockResolvedValue(formation) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)),
      auditLog: { create: jest.fn() },
    };
    const service = new FormationsService(prisma as any, {} as any, {} as any);

    await service.creer({ titre: formation.titre, prix: formation.prix } as any, { id: 'admin-1' } as any);

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    const details = JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details);
    expect(details).toEqual({
      avant: null,
      apres: {
        id: formation.id,
        titreFourni: true,
        prix: formation.prix,
        devise: formation.devise,
        statut: StatutFormation.BROUILLON,
        dateDebut: null,
        dateFin: null,
        capacite: 20,
      },
    });
  });
});

describe('transitions de formation sur l’état verrouillé', () => {
  it.each([
    ['publier', StatutFormation.PUBLIEE, BadRequestException],
    ['publier', StatutFormation.COMPLETE, BadRequestException],
    ['cloturer', StatutFormation.COMPLETE, BadRequestException],
    ['supprimer', StatutFormation.PUBLIEE, ForbiddenException],
  ])('refuse %s après une transition concurrente vers %s', async (method, statut, exception) => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'f', statut, capacite: 1 }]),
      formation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'f', statut, _count: { inscriptions: 0 } }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: (operation) => operation(tx) };
    await expect(
      (new FormationsService(prisma, {} as any, {} as any) as any)[method]('f', { id: 'admin' }),
    ).rejects.toBeInstanceOf(exception);
    expect(tx.formation.update).not.toHaveBeenCalled();
    expect(tx.formation.delete).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('confirmation imprimée d’inscription à une formation', () => {
  function servicePour(statutPaiement: StatutPaiement = StatutPaiement.REUSSI) {
    const prisma: any = {
      inscriptionFormation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ins',
          numero: 'FOR-QA',
          statut: StatutInscriptionFormation.CONFIRMEE,
          nomComplet: 'Participant fictif',
          formation: { titre: 'Cours', prix: 9000, devise: 'EUR' },
          paiement: { statut: statutPaiement, montant: 5000, devise: 'GNF' },
        }),
      },
    };
    return new FormationsService(
      prisma,
      { valeur: jest.fn().mockResolvedValue('Établissement fictif') } as any,
      { verify: jest.fn() } as any,
    );
  }
  it('imprime le montant encaissé et une inscription, sans affirmer un achèvement pédagogique', async () => {
    const html = await servicePour().certificat('ins', 'jeton', 'http://localhost');
    expect(html).toContain("Confirmation d'inscription");
    expect(html).toContain(`${(5000).toLocaleString('fr-FR')} GNF`);
    expect(html).not.toContain('EUR');
    expect(html).not.toContain('a suivi');
    expect(html).not.toContain('Vérifiable via');
  });
  it.each([StatutPaiement.EN_ATTENTE, StatutPaiement.ANNULE, StatutPaiement.REMBOURSE])(
    'refuse le document si le paiement est %s',
    async (statut) => {
      await expect(servicePour(statut).certificat('ins', 'jeton', 'http://localhost')).rejects.toBeInstanceOf(
        ConflictException,
      );
    },
  );
});

describe('Agrégat du tableau de bord des formations', () => {
  it('agrège les paiements réussis en SQL sans charger le registre complet', async () => {
    const prisma: any = {
      formation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'formation-1',
            titre: 'Gestion',
            prix: 100,
            devise: 'GNF',
            statut: StatutFormation.PUBLIEE,
          },
        ]),
      },
      inscriptionFormation: {
        groupBy: jest.fn().mockResolvedValue([
          {
            formationId: 'formation-1',
            _count: { _all: 3 },
          },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          formationId: 'formation-1',
          nbPayes: 2n,
          recette: 200,
        },
      ]),
    };
    const service = new FormationsService(prisma, {} as any, {} as any);

    const resultat = await service.dashboard();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.paiement).toBeUndefined();
    expect(resultat.parFormation[0]).toMatchObject({ nbInscrits: 3, nbPayes: 2, recette: 200 });
    expect(resultat.totaux).toEqual({ inscrits: 3, payes: 2, recette: 200 });
  });
});

describe('registre des inscriptions aux formations', () => {
  it('ne charge du paiement que les champs utilisés par le registre et le traitement', async () => {
    const prisma: any = {
      formation: { findUnique: jest.fn().mockResolvedValue({ id: 'formation-1' }) },
      inscriptionFormation: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(62),
      },
    };
    const service = new FormationsService(prisma, {} as any, {} as any);

    const resultat = await service.inscriptionsDe('formation-1', { page: 2, pageSize: 20 });

    expect(prisma.inscriptionFormation.findMany).toHaveBeenCalledWith({
      where: { formationId: 'formation-1' },
      include: INSCRIPTION_FORMATION_INCLUDE,
      orderBy: { inscriteLe: 'desc' },
      skip: 20,
      take: 20,
    });
    expect(prisma.inscriptionFormation.count).toHaveBeenCalledWith({ where: { formationId: 'formation-1' } });
    expect(resultat).toEqual({ data: [], total: 62, page: 2, pageSize: 20 });
    expect(INSCRIPTION_FORMATION_INCLUDE.paiement).toEqual({
      select: { id: true, reference: true, montant: true, devise: true, statut: true },
    });
  });

  it('borne le registre à 1 000 lignes même si le service reçoit une taille excessive', async () => {
    const prisma: any = {
      formation: { findUnique: jest.fn().mockResolvedValue({ id: 'formation-1' }) },
      inscriptionFormation: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1500),
      },
    };
    const service = new FormationsService(prisma, {} as any, {} as any);

    const resultat = await service.inscriptionsDe('formation-1', { pageSize: 5000 });

    expect(prisma.inscriptionFormation.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 1000 });
    expect(resultat).toEqual({ data: [], total: 1500, page: 1, pageSize: 1000 });
  });
});

describe('confirmation des places de formation', () => {
  it('verrouille la formation et refuse une confirmation quand la capacité est atteinte', async () => {
    const inscription = {
      id: 'for-ins-1',
      formationId: 'formation-1',
      statut: StatutInscriptionFormation.EN_ATTENTE,
      paiement: { id: 'payment-1', statut: StatutPaiement.EN_ATTENTE },
      formation: { id: 'formation-1', statut: StatutFormation.PUBLIEE, capacite: 1 },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'formation-1', statut: StatutFormation.PUBLIEE, capacite: 1 }]),
      inscriptionFormation: {
        findUnique: jest.fn().mockResolvedValue(inscription),
        count: jest.fn().mockResolvedValue(1),
      },
      paiement: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      inscriptionFormation: { findUnique: jest.fn().mockResolvedValue(inscription) },
      $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)),
    };
    const service = new FormationsService(prisma, {} as any, {} as any);

    await expect(service.confirmer('for-ins-1', { id: 'agent-1' } as any)).rejects.toBeInstanceOf(ConflictException);

    expect(tx.$queryRaw.mock.calls[0][0].join(' ')).toContain('FOR UPDATE');
    expect(tx.inscriptionFormation.count).toHaveBeenCalledWith({
      where: { formationId: 'formation-1', statut: StatutInscriptionFormation.CONFIRMEE },
    });
    expect(tx.paiement.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse de réduire ou supprimer la capacité sous les inscriptions confirmées', async () => {
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'formation-1', statut: StatutFormation.PUBLIEE, capacite: 5 }]),
      formation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'formation-1', statut: StatutFormation.PUBLIEE, capacite: 5 }),
        update: jest.fn(),
      },
      inscriptionFormation: { count: jest.fn().mockResolvedValue(3) },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)) };
    const service = new FormationsService(prisma, {} as any, {} as any);

    await expect(
      service.modifier('formation-1', { capacite: 2 } as any, { id: 'admin' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.modifier('formation-1', { capacite: null } as any, { id: 'admin' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.formation.update).not.toHaveBeenCalled();
  });

  it('refuse d’annuler une inscription confirmée sans remboursement explicite', async () => {
    const inscription: any = {
      id: 'inscription-1',
      formationId: 'formation-1',
      statut: StatutInscriptionFormation.CONFIRMEE,
      formation: { id: 'formation-1', statut: StatutFormation.PUBLIEE },
    };
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'formation-1', statut: StatutFormation.PUBLIEE, capacite: 5 }]),
      inscriptionFormation: { findUnique: jest.fn().mockResolvedValue(inscription), updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      inscriptionFormation: { findUnique: jest.fn().mockResolvedValue(inscription) },
      $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)),
    };
    const service = new FormationsService(prisma, {} as any, {} as any);

    await expect(service.annuler('inscription-1', { id: 'admin' } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inscriptionFormation.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
