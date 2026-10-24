/** Génération des séances à partir des créneaux hebdomadaires. */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role, StatutSeance, TypeCours } from '@prisma/client';
import { SeancesService, SEANCE_INCLUDE, SEANCE_INCLUDE_RESTREINT } from './seances.service';
import { isoDate } from '../../../common/utils';

const CRENEAU_LUNDI = {
  id: 'creneau-lundi',
  dateDebut: null as Date | null,
  dateFin: null as Date | null,
  affectationId: 'aff-1',
  jourSemaine: 1,
  heureDebut: '08:00',
  heureFin: '10:00',
  type: TypeCours.CM,
  salleId: 'salle-1',
};

const CRENEAU_JEUDI = {
  id: 'creneau-jeudi',
  dateDebut: null as Date | null,
  dateFin: null as Date | null,
  affectationId: 'aff-2',
  jourSemaine: 4,
  heureDebut: '13:00',
  heureFin: '15:00',
  type: TypeCours.TD,
  salleId: 'salle-2',
};

function preparer(creneaux = [CRENEAU_LUNDI, CRENEAU_JEUDI]) {
  const prisma = {
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
    affectation: {
      findFirst: jest.fn().mockResolvedValue({ id: 'aff-1', anneeId: 'annee-1', annee: { cloturee: false } }),
    },
    creneau: { findMany: jest.fn().mockResolvedValue(creneaux) },
    seance: {
      findMany: jest.fn().mockResolvedValue([{ anneeId: 'annee-1' }]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'seance-new', ...data })),
      createMany: jest.fn().mockImplementation(({ data }) => Promise.resolve({ count: data.length })),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((operation: any) => operation(prisma)),
  } as any;
  return { service: new SeancesService(prisma), prisma };
}

describe('SeancesService — génération depuis l’emploi du temps', () => {
  it('exclut les coordonnées, rémunération et données biométriques de l’enseignant dans les séances de gestion', async () => {
    const { service, prisma } = preparer();
    await service.lister({} as any, { id: 'admin-1', role: Role.ADMIN } as any);

    const include = prisma.seance.findMany.mock.calls[0][0].include;
    expect(include).toEqual(SEANCE_INCLUDE);
    expect(include.affectation.include.enseignant.select).toEqual({
      id: true,
      nom: true,
      prenom: true,
      departementId: true,
    });
    expect(include.justificatif.select).not.toHaveProperty('piece');
  });

  it('retire les preuves privées et les pièces médicales pour le personnel de terrain', async () => {
    const { service, prisma } = preparer();
    const controleur = { id: 'controleur-1', role: Role.CONTROLEUR, departementId: 'dept-1' } as any;
    await service.lister({} as any, controleur);

    const requete = prisma.seance.findMany.mock.calls[0][0];
    expect(requete.include).toEqual(SEANCE_INCLUDE_RESTREINT);
    expect(requete.include.controle.select).not.toHaveProperty('signatureBase64');
    expect(requete.include.controle.select).not.toHaveProperty('latitude');
    expect(requete.include.justificatif.select).not.toHaveProperty('piece');
    expect(requete.include.justificatif.select).not.toHaveProperty('motif');
  });

  it('verrouille la ligne de l’année ouverte dans la transaction avant génération', async () => {
    const { service, prisma } = preparer([CRENEAU_LUNDI]);
    prisma.$queryRaw = jest.fn().mockResolvedValue([{ cloturee: false }]);

    await service.generer({
      anneeId: 'annee-1',
      dateDebut: '2026-08-10',
      dateFin: '2026-08-16',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.seance.createMany).toHaveBeenCalledTimes(1);
  });

  it('refuse une année close sous verrou et ne génère aucune séance', async () => {
    const { service, prisma } = preparer([CRENEAU_LUNDI]);
    prisma.$queryRaw = jest.fn().mockResolvedValue([{ cloturee: true }]);

    await expect(
      service.generer({
        anneeId: 'annee-1',
        dateDebut: '2026-08-10',
        dateFin: '2026-08-16',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.seance.createMany).not.toHaveBeenCalled();
  });

  it('limite la génération du chef aux affectations de son département', async () => {
    const { service, prisma } = preparer();
    const chef = { id: 'chef-1', role: Role.CHEF_DEPARTEMENT, departementId: 'dept-1' } as any;

    await service.generer(
      {
        anneeId: 'annee-1',
        dateDebut: '2026-08-10',
        dateFin: '2026-08-16',
      },
      chef,
    );

    expect(prisma.creneau.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          affectation: {
            anneeId: 'annee-1',
            enseignant: { departementId: 'dept-1' },
          },
        }),
      }),
    );
  });

  it('refuse la création par un chef sur une affectation hors département', async () => {
    const { service, prisma } = preparer();
    prisma.affectation.findFirst.mockResolvedValue(null);
    const chef = { id: 'chef-1', role: Role.CHEF_DEPARTEMENT, departementId: 'dept-1' } as any;

    await expect(service.creer({ affectationId: 'aff-dept-2', date: '2026-08-10' } as any, chef)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.affectation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'aff-dept-2', enseignant: { departementId: 'dept-1' } },
      }),
    );
  });

  it('permet au contrôleur sans département une séance hors programme sur une affectation qui lui est attribuée', async () => {
    const { service, prisma } = preparer();
    const user = { id: 'ctrl-1', role: Role.CONTROLEUR, departementId: null } as any;
    await service.creer(
      {
        affectationId: 'aff-1',
        date: '2026-08-10',
        heureDebut: '08:00',
        heureFin: '10:00',
      },
      user,
    );
    expect(prisma.affectation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'aff-1',
          seances: {
            some: { OR: [{ controleurAssigneId: 'ctrl-1' }, { controle: { is: { controleurId: 'ctrl-1' } } }] },
          },
        },
      }),
    );
    expect(prisma.seance.create.mock.calls[0][0].data.controleurAssigneId).toBe('ctrl-1');
  });

  it('refuse au contrôleur sans département une affectation non attribuée', async () => {
    const { service, prisma } = preparer();
    prisma.affectation.findFirst.mockResolvedValue(null);
    await expect(
      service.creer(
        {
          affectationId: 'aff-other',
          date: '2026-08-10',
          heureDebut: '08:00',
          heureFin: '10:00',
        },
        { id: 'ctrl-1', role: Role.CONTROLEUR, departementId: null } as any,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.seance.create).not.toHaveBeenCalled();
  });

  it('crée une séance par occurrence du jour de la semaine', async () => {
    const { service, prisma } = preparer();
    // Semaine du lundi 10 au dimanche 16 août 2026 : 1 lundi + 1 jeudi
    const res = await service.generer({
      anneeId: 'annee-1',
      dateDebut: '2026-08-10',
      dateFin: '2026-08-16',
    });

    expect(res.creees).toBe(2);
    const lignes = prisma.seance.createMany.mock.calls[0][0].data;
    expect(lignes.map((l: any) => isoDate(l.date))).toEqual(['2026-08-10', '2026-08-13']);
    expect(lignes[0]).toMatchObject({
      affectationId: 'aff-1',
      creneauId: 'creneau-lundi',
      heureDebut: '08:00',
      salleId: 'salle-1',
    });
  });

  it('répète les créneaux sur plusieurs semaines', async () => {
    const { service } = preparer([CRENEAU_LUNDI]);
    const res = await service.generer({
      anneeId: 'annee-1',
      dateDebut: '2026-08-10',
      dateFin: '2026-08-31', // 4 lundis
    });
    expect(res.candidates).toBe(4);
  });

  it('ne génère que dans la période de validité du créneau', async () => {
    // « Chaque lundi 08h-12h, du 10 au 17 août » : les lundis de la fin du
    // mois ne doivent rien produire.
    const janvierSeulement = {
      ...CRENEAU_LUNDI,
      dateDebut: new Date('2026-08-10T00:00:00Z'),
      dateFin: new Date('2026-08-17T00:00:00Z'),
    };
    const { service, prisma } = preparer([janvierSeulement]);

    const res = await service.generer({
      anneeId: 'annee-1',
      dateDebut: '2026-08-01',
      dateFin: '2026-08-31',
    });

    const dates = prisma.seance.createMany.mock.calls[0][0].data.map((l: any) => isoDate(l.date));
    expect(dates).toEqual(['2026-08-10', '2026-08-17']);
    expect(res.candidates).toBe(2);
  });

  it('inclut le dernier jour de la période', async () => {
    const creneau = {
      ...CRENEAU_LUNDI,
      dateDebut: null,
      dateFin: new Date('2026-08-17T00:00:00Z'),
    };
    const { service, prisma } = preparer([creneau]);
    await service.generer({ anneeId: 'annee-1', dateDebut: '2026-08-10', dateFin: '2026-08-31' });

    const dates = prisma.seance.createMany.mock.calls[0][0].data.map((l: any) => isoDate(l.date));
    expect(dates).toContain('2026-08-17');
    expect(dates).not.toContain('2026-08-24');
  });

  it('traite un créneau sans période comme valable toute l’année', async () => {
    const { service } = preparer([{ ...CRENEAU_LUNDI, dateDebut: null, dateFin: null }]);
    const res = await service.generer({
      anneeId: 'annee-1',
      dateDebut: '2026-08-10',
      dateFin: '2026-08-31',
    });
    expect(res.candidates).toBe(4);
  });

  it('saute les jours fériés fournis', async () => {
    const { service, prisma } = preparer([CRENEAU_LUNDI]);
    const res = await service.generer({
      anneeId: 'annee-1',
      dateDebut: '2026-08-10',
      dateFin: '2026-08-24',
      joursExclus: ['2026-08-17'],
    });

    expect(res.candidates).toBe(2);
    const lignes = prisma.seance.createMany.mock.calls[0][0].data;
    expect(lignes.map((l: any) => isoDate(l.date))).toEqual(['2026-08-10', '2026-08-24']);
  });

  it('ignore les séances déjà générées (pas de doublon)', async () => {
    const { service, prisma } = preparer([CRENEAU_LUNDI]);
    prisma.seance.createMany.mockResolvedValueOnce({ count: 1 });

    const res = await service.generer({
      anneeId: 'annee-1',
      dateDebut: '2026-08-10',
      dateFin: '2026-08-17', // 2 lundis
    });

    expect(prisma.seance.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(res.creees).toBe(1);
    expect(res.ignorees).toBe(1);
  });

  it('refuse une période inversée', async () => {
    const { service } = preparer();
    await expect(
      service.generer({ anneeId: 'annee-1', dateDebut: '2026-08-20', dateFin: '2026-08-10' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une période déraisonnable', async () => {
    const { service } = preparer();
    await expect(
      service.generer({ anneeId: 'annee-1', dateDebut: '2026-01-01', dateFin: '2028-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signale l’absence de créneau actif', async () => {
    const { service } = preparer([]);
    await expect(
      service.generer({ anneeId: 'annee-1', dateDebut: '2026-08-10', dateFin: '2026-08-16' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SeancesService — clôture nocturne', () => {
  it('marque NON_TENUE les séances passées jamais contrôlées', async () => {
    const { service, prisma } = preparer();
    const res = await service.cloturerSeancesPassees();

    expect(prisma.seance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: StatutSeance.PLANIFIE,
          controle: { is: null },
        }),
        data: { statut: StatutSeance.NON_TENUE },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'SEANCES_PASSEES_CLOTUREES_AUTOMATIQUEMENT' }),
      }),
    );
    expect(res.count).toBe(3);
  });

  it('ignore une année clôturée entre la recherche des candidats et leur verrouillage', async () => {
    const { service, prisma } = preparer();
    prisma.anneeAcademique.findUnique.mockResolvedValue({ cloturee: true });
    prisma.seance.updateMany.mockResolvedValue({ count: 0 });

    await service.cloturerSeancesPassees();

    expect(prisma.seance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ anneeId: { in: [] } }),
      }),
    );
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('SeancesService — consultation par identifiant', () => {
  const user: any = { role: Role.ENSEIGNANT, enseignantId: 'ens-1' };
  it('applique à la consultation le même périmètre que la liste', async () => {
    const { service, prisma } = preparer();
    prisma.seance.findFirst = jest.fn().mockResolvedValue({ id: 'seance-1' });
    await service.consulter('seance-1', user);
    expect(prisma.seance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'seance-1', affectation: { enseignantId: 'ens-1' } },
      }),
    );
  });
  it('refuse une séance qui ne figure pas dans le périmètre', async () => {
    const { service, prisma } = preparer();
    prisma.seance.findFirst = jest.fn().mockResolvedValue(null);
    await expect(service.consulter('autre', user)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('ferme le périmètre d’un chef sans département attribué', () => {
    const { service } = preparer();
    expect(service.where({}, { role: Role.CHEF_DEPARTEMENT, departementId: null } as any)).toEqual({
      affectation: { enseignant: { departementId: '__aucun__' } },
    });
  });
  it('limite un contrôleur aux séances des enseignants de son département', () => {
    const { service } = preparer();
    expect(service.where({}, { role: Role.CONTROLEUR, departementId: 'dep-1' } as any)).toEqual({
      affectation: { enseignant: { departementId: 'dep-1' } },
    });
  });
  it('borne un contrôleur sans département à ses séances affectées ou déjà pointées', () => {
    const { service } = preparer();
    expect(service.where({}, { id: 'ctrl-1', role: Role.CONTROLEUR, departementId: null } as any)).toEqual({
      AND: [{ OR: [{ controleurAssigneId: 'ctrl-1' }, { controle: { is: { controleurId: 'ctrl-1' } } }] }],
    });
  });
});
