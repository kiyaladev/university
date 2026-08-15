/** Génération des séances à partir des créneaux hebdomadaires. */
import { BadRequestException } from '@nestjs/common';
import { StatutSeance, TypeCours } from '@prisma/client';
import { SeancesService } from './seances.service';
import { isoDate } from '../../common/utils';

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
    creneau: { findMany: jest.fn().mockResolvedValue(creneaux) },
    seance: {
      createMany: jest.fn().mockImplementation(({ data }) => Promise.resolve({ count: data.length })),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  } as any;
  return { service: new SeancesService(prisma), prisma };
}

describe('SeancesService — génération depuis l’emploi du temps', () => {
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

    expect(prisma.seance.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
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
          statut: StatutSeance.PLANIFIEE,
          controle: { is: null },
        }),
        data: { statut: StatutSeance.NON_TENUE },
      }),
    );
    expect(res.count).toBe(3);
  });
});
