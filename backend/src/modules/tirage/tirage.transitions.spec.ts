/**
 * Tirage — création et séquence des transitions.
 *
 * Le cycle est strict : PROGRAMME → IMPRIME → MIS_SOUS_PLI → DISTRIBUE →
 * RECUPERE, avec ANNULE comme issue parallèle possible tant que rien n'a
 * été imprimé. Chaque étape est gardée par le service : un saut d'étape
 * (distribuer un tirage jamais plié) ou une impression hors séquence doit
 * être refusé.
 *
 * Les contrôles déjà couverts par ailleurs — empreinte anti-substitution,
 * année close — restent dans `tirage.service.spec.ts` ; ce fichier couvre la
 * chronologie elle-même.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StadeTirage } from '@prisma/client';
import { TirageService } from './tirage.service';

const USER = { id: 'agent-1', nom: 'Agent', prenom: 'Securite', role: 'SCOLARITE' } as any;
const EMPREINTE = 'a'.repeat(64);

/** Examen rattaché, avec son année académique ouverte. */
function examen() {
  return {
    id: 'exam-1',
    codeExamen: 'EX-01',
    intitule: 'Partiel',
    anneeId: 'annee-1',
    dateExamen: new Date('2026-09-02'),
    annee: { id: 'annee-1', libelle: '2026-2027' },
    promotion: { nom: 'L1' },
    matiere: { intitule: 'Algèbre' },
    salle: null,
    surveillant: null,
  };
}

/** Tirage à un stade donné, prêt pour une transition. */
function tirage(stade: StadeTirage) {
  return {
    id: 'tirage-1',
    stade,
    empreinteSource: EMPREINTE,
    empreinteExemplaires: null,
    nbExemplaires: 10,
    dateTirage: new Date('2026-09-01'),
    imprimeur: null,
    notes: null,
    examen: examen(),
  };
}

/**
 * Faux Prisma : la transaction exécute le callback sur un « tx » dont les
 * delegates sont observables. `$queryRaw` sert à la fois au verrou
 * `FOR SHARE` (année ouverte) et au verrou `FOR UPDATE` (tirage).
 */
function preparer(stade: StadeTirage) {
  const courant = tirage(stade);
  const tx: any = {
    tirage: {
      findUnique: jest.fn().mockResolvedValue(courant),
      create: jest.fn().mockResolvedValue({ ...courant, id: 'tirage-2' }),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...courant, ...data })),
    },
    examen: { findUnique: jest.fn().mockResolvedValue({ id: 'exam-1', codeExamen: 'EX-01', anneeId: 'annee-1' }) },
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
    $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false }]),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    $transaction: jest.fn((work) => work(tx)),
    tirage: {
      findUnique: jest.fn().mockResolvedValue(courant),
      findMany: jest.fn().mockResolvedValue([courant]),
      count: jest.fn().mockResolvedValue(1),
    },
  };
  return { prisma, tx, service: new TirageService(prisma) };
}

describe('TirageService — création', () => {
  it('refuse un tirage rattaché à un examen inconnu', async () => {
    const { tx, service } = preparer(StadeTirage.PROGRAMME);
    tx.examen.findUnique.mockResolvedValue(null);

    await expect(
      service.creer(
        { examenId: 'exam-1', dateTirage: '2026-09-01', nbExemplaires: 10, empreinteSource: EMPREINTE } as any,
        USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.tirage.create).not.toHaveBeenCalled();
  });

  it('ouvre le tirage au stade PROGRAMME et normalise l’empreinte en minuscules', async () => {
    const { tx, service } = preparer(StadeTirage.PROGRAMME);

    await service.creer(
      {
        examenId: 'exam-1',
        dateTirage: '2026-09-01',
        nbExemplaires: 10,
        empreinteSource: EMPREINTE.toUpperCase(),
      } as any,
      USER,
    );

    expect(tx.tirage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          examenId: 'exam-1',
          nbExemplaires: 10,
          empreinteSource: EMPREINTE,
          stade: StadeTirage.PROGRAMME,
        }),
      }),
    );
  });

  it('trace la création du tirage dans la transaction', async () => {
    const { tx, service } = preparer(StadeTirage.PROGRAMME);

    await service.creer(
      { examenId: 'exam-1', dateTirage: '2026-09-01', nbExemplaires: 10, empreinteSource: EMPREINTE } as any,
      USER,
    );

    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'TIRAGE_CREE', entite: 'Tirage' }),
      }),
    );
  });
});

describe('TirageService — transitions de séquence', () => {
  it.each([
    ['mettreSousPli', StadeTirage.IMPRIME, StadeTirage.MIS_SOUS_PLI],
    ['distribuer', StadeTirage.MIS_SOUS_PLI, StadeTirage.DISTRIBUE],
    ['recuperer', StadeTirage.DISTRIBUE, StadeTirage.RECUPERE],
  ])('accepte %s depuis %s', async (methode, depart, arrivee) => {
    const { tx, service } = preparer(depart);

    await (service as any)[methode]('tirage-1', { stade: arrivee }, USER);

    expect(tx.tirage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stade: arrivee }) }),
    );
  });

  it.each([
    ['mettreSousPli', StadeTirage.PROGRAMME, StadeTirage.MIS_SOUS_PLI],
    ['distribuer', StadeTirage.IMPRIME, StadeTirage.DISTRIBUE],
    ['recuperer', StadeTirage.MIS_SOUS_PLI, StadeTirage.RECUPERE],
  ])('refuse %s depuis %s : le saut d’étape est interdit', async (methode, depart, arrivee) => {
    const { tx, service } = preparer(depart);

    await expect((service as any)[methode]('tirage-1', { stade: arrivee }, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.tirage.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse de plier un tirage déjà distribué', async () => {
    const { tx, service } = preparer(StadeTirage.DISTRIBUE);

    await expect(
      service.mettreSousPli('tirage-1', { stade: StadeTirage.MIS_SOUS_PLI } as any, USER),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.tirage.update).not.toHaveBeenCalled();
  });

  it('refuse de reprendre un tirage déjà récupéré', async () => {
    const { tx, service } = preparer(StadeTirage.RECUPERE);

    await expect(service.recuperer('tirage-1', { stade: StadeTirage.RECUPERE } as any, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.tirage.update).not.toHaveBeenCalled();
  });

  it('porte les notes de transition sur le tirage', async () => {
    const { tx, service } = preparer(StadeTirage.IMPRIME);

    await service.mettreSousPli('tirage-1', { stade: StadeTirage.MIS_SOUS_PLI, notes: 'Plié à 14 h' } as any, USER);

    expect(tx.tirage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notes: 'Plié à 14 h' }) }),
    );
  });

  it('trace chaque transition dans la transaction', async () => {
    const { tx, service } = preparer(StadeTirage.MIS_SOUS_PLI);

    await service.distribuer('tirage-1', { stade: StadeTirage.DISTRIBUE } as any, USER);

    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'TIRAGE_DISTRIBUE', entite: 'Tirage', entiteId: 'tirage-1' }),
      }),
    );
  });
});

describe('TirageService — impression et annulation', () => {
  it('refuse d’imprimer un tirage qui n’est plus au stade PROGRAMME', async () => {
    const { tx, service } = preparer(StadeTirage.IMPRIME);

    await expect(service.imprimer('tirage-1', { empreinteSource: EMPREINTE } as any, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.tirage.update).not.toHaveBeenCalled();
  });

  it('consigne l’imprimeur et les empreintes d’exemplaires à l’impression', async () => {
    const { tx, service } = preparer(StadeTirage.PROGRAMME);

    await service.imprimer(
      'tirage-1',
      { empreinteSource: EMPREINTE, empreinteExemplaires: 'b'.repeat(64) } as any,
      USER,
    );

    expect(tx.tirage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stade: StadeTirage.IMPRIME,
          imprimeurId: USER.id,
          empreinteExemplaires: 'b'.repeat(64),
        }),
      }),
    );
  });

  it('annule un tirage encore programmé', async () => {
    const { tx, service } = preparer(StadeTirage.PROGRAMME);

    await service.annuler('tirage-1', USER);

    expect(tx.tirage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stade: StadeTirage.ANNULE }) }),
    );
  });

  it('refuse d’annuler un tirage déjà imprimé : la traçabilité prime', async () => {
    const { tx, service } = preparer(StadeTirage.IMPRIME);

    await expect(service.annuler('tirage-1', USER)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.tirage.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('signale un tirage introuvable', async () => {
    const { prisma, service } = preparer(StadeTirage.PROGRAMME);
    prisma.tirage.findUnique.mockResolvedValue(null);

    await expect(service.trouver('tirage-x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TirageService — recherche', () => {
  it('filtre la liste par stade, examen et imprimeur', async () => {
    const { prisma, service } = preparer(StadeTirage.PROGRAMME);

    await service.liste({ stade: StadeTirage.PROGRAMME, examenId: 'exam-1', imprimeurId: 'agent-1' } as any);

    expect(prisma.tirage.findMany.mock.calls[0][0].where).toEqual({
      stade: StadeTirage.PROGRAMME,
      examenId: 'exam-1',
      imprimeurId: 'agent-1',
    });
    expect(prisma.tirage.findMany.mock.calls[0][0].orderBy).toEqual({ dateTirage: 'desc' });
  });

  it('masque l’empreinte d’un tirage encore programmé dans la liste', async () => {
    const { service } = preparer(StadeTirage.PROGRAMME);

    const page = await service.liste({} as any);

    expect((page.data[0] as any).empreinteSource).toBe(EMPREINTE.slice(0, 8));
  });

  it('révèle l’empreinte complète une fois le tirage imprimé', async () => {
    const { service } = preparer(StadeTirage.IMPRIME);

    const page = await service.liste({} as any);

    expect((page.data[0] as any).empreinteSource).toBe(EMPREINTE);
  });
});
