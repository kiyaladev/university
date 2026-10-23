/**
 * Formations — cycle de vie du catalogue et suivi des inscriptions.
 *
 * Les règles sont en tête de `formations.service.ts` :
 *
 *   - une formation naît BROUILLON ; seule la publication l'ouvre au public,
 *     la clôture arrête les demandes sans effacer les dossiers en cours ;
 *   - seul un brouillon sans aucune demande s'efface ; les autres se
 *     clôturent, pour garder la trace ;
 *   - dès qu'une inscription est confirmée (payée), le titre et le prix se
 *     figent : un diplômé a acheté la formation telle qu'affichée ;
 *   - la confirmation d'une place passe le paiement à REUSSI puis
 *     l'inscription à CONFIRME, dans cet ordre, sous verrou.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, StatutFormation, StatutInscriptionFormation, StatutPaiement } from '@prisma/client';
import { FormationsService } from './formations.service';

const USER = { id: 'admin-1', nom: 'Admin', prenom: 'Systeme', role: 'ADMIN' } as any;
const JWT = { verify: jest.fn().mockResolvedValue({ sub: 'admin-1' }) } as any;

/** Formation dans l'état demandé. */
function formation(statut: StatutFormation, surcharge: Record<string, unknown> = {}) {
  return {
    id: 'formation-1',
    titre: 'Comptabilité générale',
    description: null,
    categorie: null,
    prix: 150000,
    devise: 'GNF',
    dureeHeures: 40,
    dateDebut: null,
    dateFin: null,
    lieu: null,
    capacite: 10,
    statut,
    _count: { inscriptions: 0 },
    ...surcharge,
  };
}

/** Faux Prisma : la transaction exécute le callback sur un « tx » observable. */
function preparer(statut: StatutFormation = StatutFormation.BROUILLON, surcharge: Record<string, unknown> = {}) {
  const courante = formation(statut, surcharge);
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: courante.id, statut: courante.statut, capacite: courante.capacite }]),
    formation: {
      findUnique: jest.fn().mockResolvedValue(courante),
      create: jest.fn().mockResolvedValue(courante),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...courante, ...data })),
      delete: jest.fn().mockResolvedValue(courante),
    },
    inscriptionFormation: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'ins-1', numero: 'FOR-2026-00001', statut: 'EN_ATTENTE' }),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    paiement: {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'pay-1', reference: 'PAY-F-2026-00001', montant: 150000, devise: 'GNF' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    etudiant: { findUnique: jest.fn().mockResolvedValue({ id: 'etu-1' }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    formation: {
      findUnique: jest.fn().mockResolvedValue(courante),
      findMany: jest.fn().mockResolvedValue([courante]),
      count: jest.fn().mockResolvedValue(1),
    },
    inscriptionFormation: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    etudiant: { findUnique: jest.fn().mockResolvedValue({ id: 'etu-1' }) },
    $transaction: jest.fn((work) => work(tx)),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return { prisma, tx, service: new FormationsService(prisma, {} as any) };
}

describe('FormationsService — cycle de vie du catalogue', () => {
  it('ouvre toute formation en brouillon', async () => {
    const { tx, service } = preparer();

    await service.creer({ titre: 'Comptabilité générale' } as any, USER);

    expect(tx.formation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titre: 'Comptabilité générale',
          statut: StatutFormation.BROUILLON,
          prix: 0,
          devise: 'GNF',
        }),
      }),
    );
  });

  it('publie un brouillon', async () => {
    const { tx, service } = preparer(StatutFormation.BROUILLON);

    await service.publier('formation-1', USER);

    expect(tx.formation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: StatutFormation.PUBLIE }) }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'FORMATION_PUBLIEE', entite: 'Formation' }),
      }),
    );
  });

  it('clôture une formation publiée', async () => {
    const { tx, service } = preparer(StatutFormation.PUBLIE);

    await service.cloturer('formation-1', USER);

    expect(tx.formation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: StatutFormation.COMPLET }) }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'FORMATION_CLOTUREE', entite: 'Formation' }),
      }),
    );
  });

  it('efface un brouillon sans aucune demande déposée', async () => {
    const { tx, service } = preparer(StatutFormation.BROUILLON);

    await service.supprimer('formation-1', USER);

    expect(tx.formation.delete).toHaveBeenCalledWith({ where: { id: 'formation-1' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'FORMATION_SUPPRIMEE', entite: 'Formation' }),
      }),
    );
  });

  it('refuse d’effacer un brouillon qui a déjà reçu des demandes', async () => {
    const { tx, service } = preparer(StatutFormation.BROUILLON, { _count: { inscriptions: 2 } });

    await expect(service.supprimer('formation-1', USER)).rejects.toBeInstanceOf(ConflictException);

    expect(tx.formation.delete).not.toHaveBeenCalled();
  });

  it('refuse d’effacer une formation publiée', async () => {
    const { tx, service } = preparer(StatutFormation.PUBLIE);

    await expect(service.supprimer('formation-1', USER)).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.formation.delete).not.toHaveBeenCalled();
  });

  it('refuse de modifier le contenu d’une formation close', async () => {
    const { tx, service } = preparer(StatutFormation.COMPLET);

    await expect(service.modifier('formation-1', { lieu: 'Conakry' } as any, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.formation.update).not.toHaveBeenCalled();
  });
});

describe('FormationsService — figeage après confirmation', () => {
  it('refuse de changer le titre quand une inscription est confirmée', async () => {
    const { tx, service } = preparer(StatutFormation.PUBLIE);
    tx.inscriptionFormation.count.mockResolvedValue(1);

    await expect(service.modifier('formation-1', { titre: 'Nouveau titre' } as any, USER)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(tx.formation.update).not.toHaveBeenCalled();
  });

  it('refuse de changer le prix quand une inscription est confirmée', async () => {
    const { tx, service } = preparer(StatutFormation.PUBLIE);
    tx.inscriptionFormation.count.mockResolvedValue(1);

    await expect(service.modifier('formation-1', { prix: 1 } as any, USER)).rejects.toBeInstanceOf(ConflictException);

    expect(tx.formation.update).not.toHaveBeenCalled();
  });

  it('laisse modifier les informations de fond quand une inscription est confirmée', async () => {
    const { tx, service } = preparer(StatutFormation.PUBLIE);
    tx.inscriptionFormation.count.mockResolvedValue(1);

    await service.modifier('formation-1', { lieu: 'Conakry', description: 'Session de mars' } as any, USER);

    expect(tx.formation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lieu: 'Conakry', description: 'Session de mars' }),
      }),
    );
  });
});

describe('FormationsService — vitrine publique', () => {
  it('cache une formation non publiée derrière une absence', async () => {
    const { prisma, service } = preparer(StatutFormation.BROUILLON);

    await expect(service.formationPublique('formation-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.inscriptionFormation.count).not.toHaveBeenCalled();
  });

  it('annonce les places restantes d’une formation à capacité', async () => {
    const { prisma, service } = preparer(StatutFormation.PUBLIE, { capacite: 10 });
    prisma.inscriptionFormation.count.mockResolvedValue(4);

    const vitrine = await service.formationPublique('formation-1');

    expect(vitrine).toMatchObject({ inscrits: 4, placesRestantes: 6 });
  });

  it('ne borne pas les places d’une formation sans capacité', async () => {
    const { prisma, service } = preparer(StatutFormation.PUBLIE, { capacite: null });
    prisma.inscriptionFormation.count.mockResolvedValue(120);

    const vitrine = await service.formationPublique('formation-1');

    expect(vitrine.placesRestantes).toBeNull();
  });

  it('n’annonce jamais de place négative quand la formation est complète', async () => {
    const { prisma, service } = preparer(StatutFormation.PUBLIE, { capacite: 3 });
    prisma.inscriptionFormation.count.mockResolvedValue(5);

    const vitrine = await service.formationPublique('formation-1');

    expect(vitrine.placesRestantes).toBe(0);
  });
});

describe('FormationsService — inscription publique', () => {
  const DEMANDE = { nomComplet: 'Aminata Barry', telephone: '622000000' };

  it('refuse une demande sur une formation non publiée', async () => {
    const { prisma, service } = preparer(StatutFormation.BROUILLON);

    await expect(service.inscriptionPublique('formation-1', DEMANDE as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse une demande quand toutes les places sont réservées', async () => {
    const { prisma, service } = preparer(StatutFormation.PUBLIE, { capacite: 1 });
    prisma.inscriptionFormation.count.mockResolvedValue(1);

    await expect(service.inscriptionPublique('formation-1', DEMANDE as any)).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse un matricule inconnu', async () => {
    const { prisma, service } = preparer(StatutFormation.PUBLIE);
    prisma.etudiant.findUnique.mockResolvedValue(null);

    await expect(
      service.inscriptionPublique('formation-1', { ...DEMANDE, matricule: '2026-9999' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('dépose une demande en attente avec son paiement et son numéro de dossier', async () => {
    const { tx, service } = preparer(StatutFormation.PUBLIE);
    tx.inscriptionFormation.findMany.mockResolvedValue([]);

    const resultat = await service.inscriptionPublique('formation-1', DEMANDE as any);

    // La reference du paiement et le numero du dossier suivent leur serie :
    // « PAY-F-2026-00001 » et « FOR-2026-00001 », annee civile de l'emission.
    const annee = String(new Date().getFullYear());
    expect(tx.paiement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reference: `PAY-F-${annee}-00001`,
          montant: 150000,
          devise: 'GNF',
          mode: 'MOBILE_MONEY',
          statut: 'EN_ATTENTE',
          motif: 'Formation : Comptabilité générale',
        }),
      }),
    );
    expect(tx.inscriptionFormation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          numero: `FOR-${annee}-00001`,
          formationId: 'formation-1',
          nomComplet: 'Aminata Barry',
          statut: StatutInscriptionFormation.EN_ATTENTE,
          paiementId: 'pay-1',
        }),
      }),
    );
    expect(resultat.inscriptionId).toBe('ins-1');
    expect(resultat.montant).toBe(150000);
  });

  it('rattache la demande à la fiche étudiante du matricule fourni', async () => {
    const { tx, service } = preparer(StatutFormation.PUBLIE);

    await service.inscriptionPublique('formation-1', { ...DEMANDE, matricule: '2026-0001' } as any);

    expect(tx.inscriptionFormation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ etudiantId: 'etu-1' }) }),
    );
  });
});

describe('FormationsService — confirmation d’une place', () => {
  /** Inscription en attente, payée par un paiement en attente. */
  function inscription(surcharge: Record<string, unknown> = {}) {
    return {
      id: 'ins-1',
      numero: 'FOR-2026-00001',
      formationId: 'formation-1',
      statut: StatutInscriptionFormation.EN_ATTENTE,
      nomComplet: 'Aminata Barry',
      etudiant: null,
      formation: { id: 'formation-1', titre: 'Comptabilité générale', prix: 150000, devise: 'GNF' },
      paiement: { id: 'pay-1', statut: StatutPaiement.EN_ATTENTE, montant: 150000, devise: 'GNF' },
      ...surcharge,
    };
  }

  function preparerConfirmation(surcharge: Record<string, unknown> = {}) {
    const courante = inscription(surcharge);
    const { prisma, tx, service } = preparer(StatutFormation.PUBLIE);
    prisma.inscriptionFormation.findUnique.mockResolvedValue(courante);
    tx.inscriptionFormation.findUnique.mockResolvedValue(courante);
    return { prisma, tx, service, courante };
  }

  it('fait passer le paiement au statut réussi puis confirme l’inscription', async () => {
    const { tx, service } = preparerConfirmation();

    await service.confirmer('ins-1', USER);

    expect(tx.paiement.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', statut: StatutPaiement.EN_ATTENTE },
      data: { statut: StatutPaiement.REUSSI, completeLe: expect.any(Date) },
    });
    expect(tx.inscriptionFormation.updateMany).toHaveBeenCalledWith({
      where: { id: 'ins-1', statut: StatutInscriptionFormation.EN_ATTENTE },
      data: { statut: StatutInscriptionFormation.CONFIRME },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'FORMATION_CONFIRMEE', entite: 'InscriptionFormation' }),
      }),
    );
  });

  it('refuse de confirmer une demande annulée', async () => {
    const { tx, service } = preparerConfirmation({ statut: StatutInscriptionFormation.ANNULE });

    await expect(service.confirmer('ins-1', USER)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.paiement.updateMany).not.toHaveBeenCalled();
    expect(tx.inscriptionFormation.updateMany).not.toHaveBeenCalled();
  });

  it('refuse de confirmer une demande sans paiement rattaché', async () => {
    const { tx, service } = preparerConfirmation({ paiement: null });

    await expect(service.confirmer('ins-1', USER)).rejects.toBeInstanceOf(ConflictException);

    expect(tx.inscriptionFormation.updateMany).not.toHaveBeenCalled();
  });

  it('ne rejoue pas la confirmation d’une inscription déjà confirmée', async () => {
    const { tx, service } = preparerConfirmation({ statut: StatutInscriptionFormation.CONFIRME });

    await service.confirmer('ins-1', USER);

    expect(tx.paiement.updateMany).not.toHaveBeenCalled();
    expect(tx.inscriptionFormation.updateMany).not.toHaveBeenCalled();
  });
});

describe('FormationsService — annulation d’une demande', () => {
  it('annule une demande en attente et libère la place', async () => {
    const courante = {
      id: 'ins-1',
      numero: 'FOR-2026-00001',
      formationId: 'formation-1',
      statut: StatutInscriptionFormation.EN_ATTENTE,
      formation: { id: 'formation-1', titre: 'Comptabilité générale' },
      paiement: { id: 'pay-1', statut: StatutPaiement.EN_ATTENTE },
    };
    const { prisma, tx, service } = preparer(StatutFormation.PUBLIE);
    prisma.inscriptionFormation.findUnique.mockResolvedValue(courante);
    tx.inscriptionFormation.findUnique.mockResolvedValue(courante);

    await service.annuler('ins-1', USER);

    expect(tx.inscriptionFormation.updateMany).toHaveBeenCalledWith({
      where: { id: 'ins-1', statut: StatutInscriptionFormation.EN_ATTENTE },
      data: { statut: StatutInscriptionFormation.ANNULE },
    });
  });

  it('refuse d’annuler deux fois la même demande', async () => {
    const courante = {
      id: 'ins-1',
      formationId: 'formation-1',
      statut: StatutInscriptionFormation.ANNULE,
      formation: { id: 'formation-1' },
      paiement: null,
    };
    const { prisma, tx, service } = preparer(StatutFormation.PUBLIE);
    prisma.inscriptionFormation.findUnique.mockResolvedValue(courante);
    tx.inscriptionFormation.findUnique.mockResolvedValue(courante);

    await expect(service.annuler('ins-1', USER)).rejects.toBeInstanceOf(ConflictException);

    expect(tx.inscriptionFormation.updateMany).not.toHaveBeenCalled();
  });
});

describe('FormationsService — confirmation imprimée', () => {
  // Le jeton du nouvel onglet est vérifié par la garde globale (voir
  // common/protection-impression.spec.ts), plus par le service.
  it('refuse d’imprimer une demande non confirmée', async () => {
    const { prisma, service } = preparer();
    prisma.inscriptionFormation.findUnique.mockResolvedValue({
      id: 'ins-1',
      numero: 'FOR-2026-00001',
      statut: StatutInscriptionFormation.EN_ATTENTE,
      formation: { id: 'formation-1', titre: 'Comptabilité générale' },
      paiement: { id: 'pay-1', statut: StatutPaiement.REUSSI },
    });

    await expect(service.certificat('ins-1', 'http://localhost')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('FormationsService — tableau de bord', () => {
  it('agrège inscrits, payants et recette par formation puis au total', async () => {
    const { prisma } = preparer(StatutFormation.PUBLIE, { prix: new Prisma.Decimal('150000.00') });
    prisma.formation.findMany.mockResolvedValue([
      {
        id: 'formation-1',
        titre: 'Comptabilité générale',
        prix: new Prisma.Decimal('150000.00'),
        devise: 'GNF',
        statut: StatutFormation.PUBLIE,
      },
      {
        id: 'formation-2',
        titre: 'Audit',
        prix: new Prisma.Decimal('50000.00'),
        devise: 'GNF',
        statut: StatutFormation.BROUILLON,
      },
    ]);
    prisma.inscriptionFormation.groupBy.mockResolvedValue([
      { formationId: 'formation-1', _count: { _all: 7 } },
      { formationId: 'formation-2', _count: { _all: 3 } },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { formationId: 'formation-1', nbPayes: 5n, recette: new Prisma.Decimal('750000.00') },
    ]);
    const service = new FormationsService(prisma, {} as any);

    const tableau = await service.dashboard();

    expect(tableau.total).toBe(2);
    expect(tableau.parFormation[0]).toMatchObject({
      id: 'formation-1',
      intitule: 'Comptabilité générale',
      nbInscrits: 7,
      nbPayes: 5,
      recette: 750000,
      prix: 150000,
    });
    // Une formation sans paiement : zéro payé, recette nulle.
    expect(tableau.parFormation[1]).toMatchObject({ id: 'formation-2', nbInscrits: 3, nbPayes: 0, recette: 0 });
    expect(tableau.totaux).toEqual({ inscrits: 10, payes: 5, recette: 750000 });
  });
});
