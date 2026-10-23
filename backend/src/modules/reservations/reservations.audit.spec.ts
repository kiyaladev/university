/**
 * Journal avant/après des réservations de salle — création, modification,
 * décision et annulation.
 *
 * Ce que ces tests verrouillent :
 *  - l'acteur (compte connecté) et l'entité visée sont inscrits ;
 *  - l'état avant et après est complet sur le créneau et le statut, sans le
 *    motif, l'organisme, le responsable ni le motif de refus, et sans jamais
 *    toucher à la salle (jeton QR, coordonnées) ;
 *  - la mutation et son entrée de journal partagent la transaction ;
 *  - une mutation refusée n'écrit rien, ni réservation ni trace.
 */
import { ConflictException } from '@nestjs/common';
import { Role, StatutReservationSalle } from '@prisma/client';
import type { AuthUser } from '../../common/decorators';
import { ReservationsService } from './reservations.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

/**
 * Fausse transaction PostgreSQL : les écritures de mutation et de journal ne
 * sont conservées qu'en cas de succès. Un journal écrit hors transaction
 * survivrait à l'échec de la mutation — ces tests le détectent.
 */
const METHODES_ECRITURE = ['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

function transaction(base: any, tx: any) {
  const journal: any[] = [];
  const mutations: string[] = [];
  const flags = { echecEcriture: null as string | null, echecJournal: false };

  const handler: ProxyHandler<any> = {
    get(objet, propriete) {
      if (propriete === 'auditLog') {
        return {
          create: async (args: any) => {
            if (flags.echecJournal) throw new Error('journal indisponible');
            journal.push(args);
            return args;
          },
        };
      }
      const valeur = (objet as any)[propriete];
      const nom = String(propriete);
      if (typeof valeur === 'function' && METHODES_ECRITURE.includes(nom)) {
        return async (...args: any[]) => {
          if (flags.echecEcriture === nom) throw new Error('mutation refusée');
          mutations.push(nom);
          return valeur.apply(objet, args);
        };
      }
      if (valeur && typeof valeur === 'object') return new Proxy(valeur, handler);
      return valeur;
    },
  };
  const client = new Proxy(tx, handler);

  base.$transaction = jest.fn(async (operation: (c: any) => unknown, _options?: unknown) => {
    try {
      return await operation(client);
    } catch (e) {
      // Rollback : ni la mutation ni son journal ne sont conservés.
      mutations.length = 0;
      journal.length = 0;
      throw e;
    }
  });
  return { journal, mutations, flags };
}

describe('Journal avant/après des réservations de salle', () => {
  const enseignant = { id: 'user-1', role: Role.ENSEIGNANT } as AuthUser;
  const admin = { id: 'admin-1', role: Role.ADMIN } as AuthUser;

  const demande = () => ({
    id: 'reservation-1',
    salleId: 'salle-1',
    motif: 'Événement privé confidentiel',
    organisme: 'Organisation privée',
    dateJour: new Date('2026-10-02T00:00:00.000Z'),
    heureDebut: '09:00',
    heureFin: '10:00',
    responsable: 'Personne privée',
    statut: StatutReservationSalle.EN_ATTENTE,
    demandeurId: 'user-1',
    refuseParId: null,
    refuseMotif: null,
    // La salle n'est jamais projetée : jeton QR et coordonnées restent hors journal.
    salle: {
      id: 'salle-1', code: 'AMPHI-A', nom: 'Amphi A',
      qrToken: 'jeton-qr-salle', latitude: 9.6412, longitude: -13.5786,
    },
  });

  const instantane = (statut: StatutReservationSalle, extra: Record<string, unknown> = {}) => ({
    id: 'reservation-1',
    salleId: 'salle-1',
    dateJour: '2026-10-02T00:00:00.000Z',
    heureDebut: '09:00',
    heureFin: '10:00',
    statut,
    demandeurId: 'user-1',
    refuseParId: null,
    motifFourni: true,
    organismeFourni: true,
    responsableFourni: true,
    refuseMotifFourni: false,
    ...extra,
  });

  function preparer() {
    const courante = demande();
    const tx: any = {
      reservationSalle: {
        findUnique: jest.fn().mockResolvedValue(courante),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(courante),
        update: jest.fn().mockResolvedValue(courante),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma: any = {
      reservationSalle: {
        findUnique: jest.fn().mockResolvedValue(courante),
        findMany: jest.fn().mockResolvedValue([]),
      },
      // Un journal écrit hors transaction serait visible ici.
      auditLog: { create: jest.fn() },
    };
    const ecritures = transaction(prisma, tx);
    return { service: new ReservationsService(prisma), prisma, tx, ...ecritures };
  }

  const details = (journal: any[]) => JSON.parse(journal[0].data.details);

  it("journalise la demande dans la transaction, sans motif ni données de salle", async () => {
    const { service, prisma, journal, mutations } = preparer();

    await service.creer({
      salleId: 'salle-1',
      motif: 'Événement privé confidentiel',
      dateJour: '2026-10-02',
      heureDebut: '09:00',
      heureFin: '10:00',
    } as any, enseignant);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
    expect(mutations).toEqual(['create']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'user-1',
      action: 'RESERVATION_CREEE',
      entite: 'ReservationSalle',
      entiteId: 'reservation-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toBeNull();
    expect(ecrit.apres).toEqual(instantane(StatutReservationSalle.EN_ATTENTE));
    const brut = journal[0].data.details;
    expect(brut).not.toContain('Événement privé confidentiel');
    expect(brut).not.toContain('Organisation privée');
    expect(brut).not.toContain('Personne privée');
    expect(brut).not.toContain('jeton-qr-salle');
    expect(brut).not.toContain('9.6412');
    expect(brut).not.toContain('-13.5786');
  });

  it('journalise la modification du créneau avec les états avant et après', async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.reservationSalle.update.mockResolvedValue({
      ...demande(), heureDebut: '11:00', heureFin: '12:00',
    });

    await service.modifier('reservation-1', { heureDebut: '11:00', heureFin: '12:00' } as any, enseignant);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
    expect(mutations).toEqual(['update']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'user-1',
      action: 'RESERVATION_MODIFIEE',
      entite: 'ReservationSalle',
      entiteId: 'reservation-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toEqual(instantane(StatutReservationSalle.EN_ATTENTE));
    expect(ecrit.apres).toEqual(instantane(StatutReservationSalle.EN_ATTENTE, {
      heureDebut: '11:00', heureFin: '12:00',
    }));
    expect(ecrit.champsModifies).toEqual(['heureDebut', 'heureFin']);
  });

  it('journalise le refus sans conserver le motif de refus', async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.reservationSalle.update.mockResolvedValue({
      ...demande(),
      statut: StatutReservationSalle.REFUSEE,
      refuseParId: 'admin-1',
      refuseMotif: 'motif de refus confidentiel',
    });

    await service.decider('reservation-1', { statut: 'REFUSEE', motif: 'motif de refus confidentiel' } as any, admin);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['update']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'RESERVATION_REFUSEE',
      entite: 'ReservationSalle',
      entiteId: 'reservation-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toEqual(instantane(StatutReservationSalle.EN_ATTENTE));
    expect(ecrit.apres).toEqual(instantane(StatutReservationSalle.REFUSEE, {
      refuseParId: 'admin-1',
      refuseMotifFourni: true,
    }));
    expect(ecrit.champsModifies).toEqual(['statut', 'refuseParId', 'refuseMotif']);
    expect(ecrit.refuseMotifFourni).toBe(true);
    expect(journal[0].data.details).not.toContain('motif de refus confidentiel');
  });

  it('journalise la confirmation, seule transition sans motif associé', async () => {
    const { service, prisma, tx, journal } = preparer();
    tx.reservationSalle.update.mockResolvedValue({
      ...demande(), statut: StatutReservationSalle.CONFIRMEE,
    });

    await service.decider('reservation-1', { statut: 'CONFIRMEE' } as any, admin);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(journal).toHaveLength(1);
    const ecrit = details(journal);
    expect(ecrit.avant.statut).toBe(StatutReservationSalle.EN_ATTENTE);
    expect(ecrit.apres.statut).toBe(StatutReservationSalle.CONFIRMEE);
    expect(ecrit.apres.refuseParId).toBeNull();
    expect(ecrit.champsModifies).toEqual(['statut']);
    expect(ecrit.refuseMotifFourni).toBe(false);
  });

  it("journalise l'annulation avec l'état avant et un après vide", async () => {
    const { service, prisma, journal, mutations } = preparer();

    const resultat = await service.supprimer('reservation-1', enseignant);

    expect(resultat).toEqual({ id: 'reservation-1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['delete']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'user-1',
      action: 'RESERVATION_SUPPRIMEE',
      entite: 'ReservationSalle',
      entiteId: 'reservation-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toEqual(instantane(StatutReservationSalle.EN_ATTENTE));
    expect(ecrit.apres).toBeNull();
    expect(journal[0].data.details).not.toContain('Événement privé confidentiel');
  });

  it("n'écrit aucun journal lorsque la décision échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecEcriture = 'update';

    await expect(service.decider('reservation-1', { statut: 'CONFIRMEE' } as any, admin))
      .rejects.toThrow('mutation refusée');

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("annule la décision si l'écriture du journal échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecJournal = true;

    await expect(service.decider('reservation-1', { statut: 'CONFIRMEE' } as any, admin))
      .rejects.toThrow('journal indisponible');

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'ouvre aucune transaction ni journal sur une demande déjà statuée", async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.reservationSalle.findUnique.mockResolvedValue({
      ...demande(), statut: StatutReservationSalle.CONFIRMEE,
    });

    await expect(service.modifier('reservation-1', { heureDebut: '11:00' } as any, enseignant))
      .rejects.toThrow('reservations.une_reservation_deja_statuee_ne_peut_plus_etre_modifiee');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(journal).toEqual([]);
    expect(mutations).toEqual([]);
  });

  it('vérifie le conflit dans la transaction avant de confirmer', async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.reservationSalle.findMany.mockResolvedValue([{
      ...demande(), id: 'reservation-overlap', statut: StatutReservationSalle.CONFIRMEE,
      heureDebut: '09:30', heureFin: '10:30',
    }]);

    await expect(service.decider('reservation-1', { statut: 'CONFIRMEE' } as any, admin))
      .rejects.toThrow('reservations.cette_salle_est_deja_reservee_de_collision_heuredebut_a_collision_');

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(tx.reservationSalle.findMany).toHaveBeenCalled();
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it('traduit un conflit de sérialisation en 409 lisible', async () => {
    const { service, prisma, journal, mutations } = preparer();
    const collision = Object.assign(new Error('serialization failure'), { code: 'P2034' });
    prisma.$transaction.mockRejectedValue(collision);

    await expect(service.creer({
      salleId: 'salle-1', motif: 'test', dateJour: '2026-10-02',
      heureDebut: '09:00', heureFin: '10:00',
    } as any, enseignant)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.creer({
      salleId: 'salle-1', motif: 'test', dateJour: '2026-10-02',
      heureDebut: '09:00', heureFin: '10:00',
    } as any, enseignant)).rejects.toThrow('reservations.ecriture_concurrente_reessayez');

    expect(journal).toEqual([]);
    expect(mutations).toEqual([]);
  });
});
