import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../../common/decorators';
import { ReservationsService } from './reservations.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Périmètre des réservations', () => {
  const teacher = { id: 'user-1', enseignantId: 'teacher-1', role: Role.ENSEIGNANT } as AuthUser;
  const otherReservation = {
    id: 'reservation-1',
    salleId: 'room-1',
    demandeurId: 'teacher-2',
    dateJour: new Date('2026-10-02T00:00:00.000Z'),
    heureDebut: '09:00',
    heureFin: '10:00',
    statut: 'CONFIRME',
    motif: 'Événement privé',
    organisme: 'Organisation privée',
    demandeur: { id: 'teacher-2', nom: 'Diallo', prenom: 'Awa' },
    refuseParId: 'admin-1',
    refusePar: { id: 'admin-1', nom: 'Admin', prenom: 'Un' },
    refuseMotif: 'Détail privé',
  };
  const prepare = () => {
    const db: any = {
      reservationSalle: {
        findMany: jest.fn().mockResolvedValue([otherReservation]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(otherReservation),
      },
      seance: { findMany: jest.fn().mockResolvedValue([]) },
      salle: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { db, service: new ReservationsService(db) };
  };

  it('limite la liste d’un enseignant à ses propres demandes', async () => {
    const { db, service } = prepare();
    await service.liste({} as any, teacher);
    const where = db.reservationSalle.findMany.mock.calls[0][0].where;
    expect(where.demandeurId).toBe(teacher.id);
    expect(db.reservationSalle.count).toHaveBeenCalledWith({ where });
  });

  it('masque le détail direct d’une réservation appartenant à un tiers', async () => {
    const { service } = prepare();
    await expect(service.consulter(otherReservation.id, teacher)).rejects.toThrow(NotFoundException);
  });

  it('laisse le calendrier visible pour vérifier les salles, sans publier les détails des tiers', async () => {
    const { db, service } = prepare();
    const result = await service.calendrier({ dateDebut: '2026-10-02', dateFin: '2026-10-02' } as any, teacher);
    const reservation = result.jours[0].reservations[0];
    expect(reservation).toMatchObject({
      id: otherReservation.id,
      salleId: otherReservation.salleId,
      statut: 'CONFIRME',
    });
    expect(reservation).toMatchObject({
      motif: null,
      organisme: null,
      responsable: null,
      demandeurId: null,
      demandeur: null,
      refusePar: null,
      refuseMotif: null,
    });
    expect(db.salle.findMany.mock.calls[0][0].select).toEqual({
      id: true,
      code: true,
      nom: true,
      batiment: true,
      capacite: true,
      actif: true,
    });
    expect(db.salle.findMany.mock.calls[0][0].select).not.toHaveProperty('qrToken');
    expect(db.seance.findMany.mock.calls[0][0].where.affectation).toEqual({ enseignantId: 'teacher-1' });
  });

  it('limite les séances du calendrier d’un contrôleur à son département ou à ses affectations', async () => {
    const { db, service } = prepare();
    await service.calendrier(
      { dateDebut: '2026-10-02', dateFin: '2026-10-02' } as any,
      {
        id: 'ctrl-1',
        role: Role.CONTROLEUR,
        departementId: 'dept-1',
      } as any,
    );
    expect(db.seance.findMany.mock.calls[0][0].where.affectation).toEqual({
      enseignant: { departementId: 'dept-1' },
    });

    const sansDepartement = prepare();
    await sansDepartement.service.calendrier(
      { dateDebut: '2026-10-02', dateFin: '2026-10-02' } as any,
      {
        id: 'ctrl-2',
        role: Role.CONTROLEUR,
        departementId: null,
      } as any,
    );
    expect(sansDepartement.db.seance.findMany.mock.calls[0][0].where.OR).toEqual([
      { controleurAssigneId: 'ctrl-2' },
      { controle: { is: { controleurId: 'ctrl-2' } } },
    ]);
  });

  it('refuse une période de calendrier supérieure à 93 jours avant toute requête', async () => {
    const { db, service } = prepare();
    await expect(
      service.calendrier({ dateDebut: '1900-01-01', dateFin: '9999-12-31' } as any, teacher),
    ).rejects.toThrow(BadRequestException);
    expect(db.reservationSalle.findMany).not.toHaveBeenCalled();
    expect(db.seance.findMany).not.toHaveBeenCalled();
    expect(db.salle.findMany).not.toHaveBeenCalled();
  });

  it('permet au demandeur de consulter son propre détail', async () => {
    const { service } = prepare();
    await expect(
      service.consulter(otherReservation.id, { ...teacher, id: otherReservation.demandeurId }),
    ).resolves.toEqual(otherReservation);
  });
});
