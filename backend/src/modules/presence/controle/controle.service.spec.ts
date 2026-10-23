/** Règles de pointage : déduction du statut, durée effective, preuves. */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, Role, StatutPresence, StatutSeance } from '@prisma/client';
import { ControleService } from './controle.service';
import { AuthUser } from '../../../common/decorators';

const CONTROLEUR: AuthUser = {
  id: 'user-1',
  email: 'controleur1@unipresence.gn',
  nom: 'SOUMAH',
  prenom: 'Facinet',
  role: Role.CONTROLEUR,
  departementId: null,
  enseignantId: null,
  etudiantId: null,
};

const SEANCE = {
  id: 'seance-1',
  anneeId: 'annee-open',
  statut: StatutSeance.PLANIFIE,
  heureDebut: '08:00',
  heureFin: '10:00',
  controleurAssigneId: 'user-1',
  salle: {
    id: 'salle-1',
    qrToken: 'UP-salle-1',
    latitude: 9.5335,
    longitude: -13.6875,
    rayonMetres: 80,
  },
  affectation: { id: 'aff-1', enseignantId: 'ens-1', enseignant: { id: 'ens-1', departementId: 'dept-1' } },
};

function preparer(options: { parametres?: Record<string, unknown>; seance?: any } = {}) {
  const prisma = {
    seance: {
      findUnique: jest.fn().mockResolvedValue(options.seance ?? SEANCE),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    salle: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'salle-1', code: 'A1', nom: 'Amphi A', actif: true, qrToken: 'secret-qr' }),
    },
    controle: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
    $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false }]),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  prisma.$transaction = jest.fn((operation: (tx: any) => unknown) => operation(prisma));

  const valeurs: Record<string, unknown> = {
    TOLERANCE_RETARD_MIN: 15,
    ABSENCE_APRES_MIN: 30,
    QR_OBLIGATOIRE: false,
    GEOLOC_OBLIGATOIRE: false,
    ATTESTATION_OBLIGATOIRE: false,
    SIGNATURE_OBLIGATOIRE: false,
    EFFECTIF_OBLIGATOIRE: false,
    ...(options.parametres ?? {}),
  };

  const parametres = {
    nombre: jest.fn((cle: string, defaut: number) => Promise.resolve((valeurs[cle] as number) ?? defaut)),
    booleen: jest.fn((cle: string, defaut: boolean) => Promise.resolve((valeurs[cle] as boolean) ?? defaut)),
  } as any;

  // L'attestation de l'enseignant est testée séparément (attestation.service.spec).
  const attestation = {
    verifierPreuves: jest.fn(async (_ens: string, preuves: any) => {
      if (preuves.empreinte) return { mode: 'EMPREINTE', valide: true, score: preuves.empreinte.score };
      if (preuves.codePinEnseignant) return { mode: 'CODE_PIN', valide: true };
      if (preuves.signatureBase64) return { mode: 'SIGNATURE', valide: true };
      return { mode: 'AUCUNE', valide: false };
    }),
  } as any;

  return { service: new ControleService(prisma, parametres, attestation), prisma, attestation };
}

describe('ControleService — déduction du statut de présence', () => {
  it('refuse au chef un pointage de séance appartenant à un autre département', async () => {
    const { service, prisma } = preparer({
      seance: {
        ...SEANCE,
        affectation: { ...SEANCE.affectation, enseignant: { id: 'ens-2', departementId: 'dept-2' } },
      },
    });
    const chef = { ...CONTROLEUR, role: Role.CHEF_DEPARTEMENT, departementId: 'dept-1' };

    await expect(service.pointer({ seanceId: 'seance-1' }, chef)).rejects.toThrow(NotFoundException);
    expect(prisma.controle.create).not.toHaveBeenCalled();
    expect(prisma.controle.update).not.toHaveBeenCalled();
  });

  it('refuse au contrôleur une séance hors de son attribution et de son département', async () => {
    const { service, prisma } = preparer({
      seance: { ...SEANCE, controleurAssigneId: 'user-2', controle: null },
    });

    await expect(service.pointer({ seanceId: 'seance-1', statut: StatutPresence.ABSENT }, CONTROLEUR)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.pointer(
        { seanceId: 'seance-1', statut: StatutPresence.ABSENT },
        { ...CONTROLEUR, departementId: 'dept-2' },
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.controle.create).not.toHaveBeenCalled();
    expect(prisma.controle.update).not.toHaveBeenCalled();
  });

  it('laisse le contrôleur du département pointer une séance non attribuée', async () => {
    const { service, prisma } = preparer({ seance: { ...SEANCE, controleurAssigneId: null } });
    await service.pointer(
      { seanceId: 'seance-1', statut: StatutPresence.ABSENT },
      { ...CONTROLEUR, departementId: 'dept-1' },
    );
    expect(prisma.controle.create).toHaveBeenCalled();
  });

  it('refuse une heure de fin réelle antérieure ou égale à l’arrivée', async () => {
    const { service, prisma } = preparer();
    for (const heureFinReelle of ['07:00', '08:00']) {
      await expect(
        service.pointer({ seanceId: 'seance-1', heureArrivee: '08:00', heureFinReelle }, CONTROLEUR),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.controle.create).not.toHaveBeenCalled();
  });

  it('refuse la seconde première saisie concurrente au lieu d’écraser la première', async () => {
    const { service, prisma } = preparer();
    // Les deux saisies ont lu `existant === null` ; la base refuse le second INSERT.
    prisma.controle.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(
      service.pointer({ seanceId: 'seance-1', statut: StatutPresence.ABSENT }, CONTROLEUR),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.controle.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('considère présent un enseignant arrivé dans la tolérance', async () => {
    const { service } = preparer();
    const controle: any = await service.pointer(
      { seanceId: 'seance-1', heureArrivee: '08:10', heureFinReelle: '09:55' },
      CONTROLEUR,
    );
    expect(controle.statut).toBe(StatutPresence.PRESENT);
    expect(controle.dureeMinutes).toBe(105);
  });

  it('bascule en retard au-delà de la tolérance', async () => {
    const { service } = preparer();
    const controle: any = await service.pointer(
      { seanceId: 'seance-1', heureArrivee: '08:22', heureFinReelle: '09:58' },
      CONTROLEUR,
    );
    expect(controle.statut).toBe(StatutPresence.RETARD);
    expect(controle.dureeMinutes).toBe(96);
  });

  it('déclare absent au-delà du délai configuré', async () => {
    const { service } = preparer();
    const controle: any = await service.pointer({ seanceId: 'seance-1', heureArrivee: '08:45' }, CONTROLEUR);
    expect(controle.statut).toBe(StatutPresence.ABSENT);
    expect(controle.dureeMinutes).toBe(0);
  });

  it('déclare absent quand aucune heure d’arrivée n’est constatée', async () => {
    const { service } = preparer();
    const controle: any = await service.pointer({ seanceId: 'seance-1' }, CONTROLEUR);
    expect(controle.statut).toBe(StatutPresence.ABSENT);
  });

  it('respecte le statut imposé par le contrôleur', async () => {
    const { service } = preparer();
    const controle: any = await service.pointer(
      { seanceId: 'seance-1', statut: StatutPresence.REMPLACE, heureArrivee: '08:40' },
      CONTROLEUR,
    );
    expect(controle.statut).toBe(StatutPresence.REMPLACE);
  });

  it('retient la durée planifiée quand les heures réelles manquent', async () => {
    const { service } = preparer();
    const controle: any = await service.pointer({ seanceId: 'seance-1', statut: StatutPresence.PRESENT }, CONTROLEUR);
    expect(controle.dureeMinutes).toBe(120);
  });

  it('applique la tolérance paramétrée par l’établissement', async () => {
    const { service } = preparer({ parametres: { TOLERANCE_RETARD_MIN: 30 } });
    const controle: any = await service.pointer({ seanceId: 'seance-1', heureArrivee: '08:25' }, CONTROLEUR);
    expect(controle.statut).toBe(StatutPresence.PRESENT);
  });
});

describe('ControleService — année académique clôturée', () => {
  it('refuse le premier pointage d’une séance d’une année clôturée', async () => {
    const { service, prisma } = preparer({
      seance: { ...SEANCE, anneeId: 'annee-close', affectation: { ...SEANCE.affectation, anneeId: 'annee-open' } },
    });
    prisma.$queryRaw.mockResolvedValue([{ cloturee: true }]);

    await expect(service.pointer({ seanceId: 'seance-1' }, CONTROLEUR)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.controle.create).not.toHaveBeenCalled();
    expect(prisma.controle.update).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw.mock.calls[0][0].join('')).toContain('FOR SHARE');
  });

  it('refuse la correction d’un pointage existant dans une année clôturée', async () => {
    const { service, prisma } = preparer({
      seance: { ...SEANCE, anneeId: 'annee-close', affectation: { ...SEANCE.affectation, anneeId: 'annee-open' } },
    });
    prisma.$queryRaw.mockResolvedValue([{ cloturee: true }]);
    prisma.controle.findUnique.mockResolvedValue({
      id: 'c-existing',
      controleurId: CONTROLEUR.id,
      statut: StatutPresence.ABSENT,
    });

    await expect(service.pointer({ seanceId: 'seance-1' }, CONTROLEUR)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.controle.create).not.toHaveBeenCalled();
    expect(prisma.controle.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse la suppression d’un pointage appartenant à une année clôturée', async () => {
    const { service, prisma } = preparer();
    prisma.controle.findUnique.mockResolvedValue({
      id: 'c-existing',
      controleurId: 'user-2',
      seance: {
        anneeId: 'annee-close',
        affectation: { enseignant: { id: 'ens-1', departementId: 'dep-1' }, anneeId: 'annee-open' },
      },
    });
    prisma.$queryRaw.mockResolvedValue([{ cloturee: true }]);

    await expect(service.supprimer('c-existing', { ...CONTROLEUR, role: Role.ADMIN })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.controle.delete).not.toHaveBeenCalled();
  });
});

describe('ControleService — preuves et garde-fous', () => {
  it('refuse un QR ne correspondant pas à la salle de la séance', async () => {
    const { service } = preparer();
    await expect(
      service.pointer({ seanceId: 'seance-1', qrToken: 'UP-autre-salle' }, CONTROLEUR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marque le QR comme valide et enregistre la méthode', async () => {
    const { service } = preparer();
    const controle: any = await service.pointer(
      { seanceId: 'seance-1', qrToken: 'UP-salle-1', heureArrivee: '08:05' },
      CONTROLEUR,
    );
    expect(controle.qrSalleValide).toBe(true);
    expect(controle.methode).toBe('QR_SALLE');
  });

  it('exige le QR quand le paramètre l’impose', async () => {
    const { service } = preparer({ parametres: { QR_OBLIGATOIRE: true } });
    await expect(service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05' }, CONTROLEUR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuse une position hors du rayon de la salle si la géolocalisation est exigée', async () => {
    const { service } = preparer({ parametres: { GEOLOC_OBLIGATOIRE: true } });
    await expect(
      service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05', latitude: 9.55, longitude: -13.6875 }, CONTROLEUR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepte une position dans le rayon et calcule la distance', async () => {
    const { service } = preparer({ parametres: { GEOLOC_OBLIGATOIRE: true } });
    const controle: any = await service.pointer(
      { seanceId: 'seance-1', heureArrivee: '08:05', latitude: 9.5337, longitude: -13.6875 },
      CONTROLEUR,
    );
    expect(controle.distanceMetres).toBeLessThan(80);
    expect(controle.methode).toBe('GEOLOCALISATION');
  });

  it('exige le comptage des étudiants quand le paramètre l’impose', async () => {
    const { service } = preparer({ parametres: { EFFECTIF_OBLIGATOIRE: true } });
    await expect(service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05' }, CONTROLEUR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuse le pointage d’un enseignant présent sans aucune attestation', async () => {
    const { service } = preparer({ parametres: { ATTESTATION_OBLIGATOIRE: true } });
    await expect(service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05' }, CONTROLEUR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepte le pointage dès qu’un moyen d’attestation est fourni', async () => {
    const { service } = preparer({ parametres: { ATTESTATION_OBLIGATOIRE: true } });
    const controle: any = await service.pointer(
      { seanceId: 'seance-1', heureArrivee: '08:05', codePinEnseignant: '1234' },
      CONTROLEUR,
    );
    expect(controle.attestation).toBe('CODE_PIN');
    expect(controle.attestationValide).toBe(true);
  });

  it('n’exige aucune attestation lorsque l’enseignant est absent', async () => {
    const { service } = preparer({ parametres: { ATTESTATION_OBLIGATOIRE: true } });
    const controle: any = await service.pointer({ seanceId: 'seance-1' }, CONTROLEUR);
    expect(controle.statut).toBe(StatutPresence.ABSENT);
    expect(controle.attestation).toBe('AUCUNE');
  });

  it('exige la signature manuscrite quand elle est spécifiquement imposée', async () => {
    const { service } = preparer({ parametres: { SIGNATURE_OBLIGATOIRE: true } });
    await expect(
      service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05', codePinEnseignant: '1234' }, CONTROLEUR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse de pointer une séance annulée', async () => {
    const { service } = preparer({ seance: { ...SEANCE, statut: StatutSeance.ANNULE } });
    await expect(service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05' }, CONTROLEUR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('met la séance à jour et journalise le pointage', async () => {
    const { service, prisma } = preparer();
    await service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05' }, CONTROLEUR, '10.0.0.1');

    expect(prisma.seance.update).toHaveBeenCalledWith({
      where: { id: 'seance-1' },
      data: { statut: StatutSeance.CONTROLE },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'POINTAGE' }) }),
    );
  });

  it('bascule la séance en NON_TENUE lorsque l’enseignant est absent', async () => {
    const { service, prisma } = preparer();
    await service.pointer({ seanceId: 'seance-1' }, CONTROLEUR);

    expect(prisma.seance.update).toHaveBeenCalledWith({
      where: { id: 'seance-1' },
      data: { statut: StatutSeance.NON_TENUE },
    });
  });
});

describe('ControleService — synchronisation hors ligne', () => {
  it('isole les échecs sans interrompre le lot', async () => {
    const { service, prisma } = preparer();
    prisma.seance.findUnique.mockResolvedValueOnce(SEANCE).mockResolvedValueOnce(null); // deuxième séance inconnue

    const res = await service.synchroniser(
      {
        pointages: [
          { seanceId: 'seance-1', heureArrivee: '08:05' },
          { seanceId: 'inconnue', heureArrivee: '10:20' },
        ],
      },
      CONTROLEUR,
    );

    expect(res.recus).toBe(2);
    expect(res.synchronises).toBe(1);
    expect(res.echecs).toHaveLength(1);
    expect(res.echecs[0].seanceId).toBe('inconnue');
  });

  it('marque les pointages synchronisés comme saisis hors ligne', async () => {
    const { service } = preparer();
    const res = await service.synchroniser(
      { pointages: [{ seanceId: 'seance-1', heureArrivee: '08:05' }] },
      CONTROLEUR,
    );
    expect(res.synchronises).toBe(1);
  });
});

describe('ControleService — périmètre de consultation', () => {
  const enseignant: AuthUser = { ...CONTROLEUR, role: Role.ENSEIGNANT, enseignantId: 'ens-1' };
  const chef: AuthUser = { ...CONTROLEUR, role: Role.CHEF_DEPARTEMENT, departementId: 'dep-1' };

  it.each([
    [enseignant, { enseignantId: 'ens-2' }, { enseignantId: 'ens-1' }],
    [chef, { departementId: 'dep-2' }, { enseignant: { departementId: 'dep-1' } }],
  ])('impose le périmètre du compte malgré les filtres URL', async (user, query, expected) => {
    const { service, prisma } = preparer();
    prisma.controle.findMany = jest.fn().mockResolvedValue([]);
    prisma.controle.count = jest.fn().mockResolvedValue(0);
    await service.liste(query, user);
    expect(prisma.controle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ seance: { affectation: expected } }),
      }),
    );
    expect(prisma.controle.count).toHaveBeenCalledWith({ where: prisma.controle.findMany.mock.calls[0][0].where });
  });

  it('borne la liste et le détail d’un contrôleur à son département', async () => {
    const { service, prisma } = preparer();
    prisma.controle.findMany = jest.fn().mockResolvedValue([]);
    prisma.controle.count = jest.fn().mockResolvedValue(0);
    const controleur = { ...CONTROLEUR, departementId: 'dept-1' };
    await service.liste({ controleurId: 'autre', departementId: 'dept-other' } as any, controleur);
    expect(prisma.controle.findMany.mock.calls[0][0].where).toMatchObject({
      seance: { affectation: { enseignant: { departementId: 'dept-1' } } },
    });
    expect(prisma.controle.findMany.mock.calls[0][0].where.controleurId).toBe('autre');

    prisma.controle.findFirst.mockResolvedValue({ id: 'controle-1' });
    await service.findOne('controle-autre', controleur);
    expect(prisma.controle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'controle-autre',
          seance: { affectation: { enseignant: { departementId: 'dept-1' } } },
        },
      }),
    );
  });

  it('retourne aux rôles terrain une projection sans signature, GPS, observation ni score biométrique', async () => {
    const { service, prisma } = preparer();
    prisma.controle.findMany = jest.fn().mockResolvedValue([]);
    prisma.controle.count = jest.fn().mockResolvedValue(0);

    await service.liste({}, CONTROLEUR);

    const select = prisma.controle.findMany.mock.calls[0][0].select;
    expect(select).toMatchObject({
      id: true,
      statut: true,
      seance: {
        select: {
          affectation: {
            select: {
              enseignant: {
                select: {
                  id: true,
                  nom: true,
                  prenom: true,
                  departement: { select: { id: true, code: true, nom: true } },
                },
              },
            },
          },
        },
      },
    });
    for (const field of ['signatureBase64', 'latitude', 'longitude', 'observation', 'empreinteScore']) {
      expect(select).not.toHaveProperty(field);
    }

    prisma.controle.findFirst.mockResolvedValue({ id: 'controle-1' });
    await service.findOne('controle-1', CONTROLEUR);
    expect(prisma.controle.findFirst.mock.calls[0][0].select).toEqual(select);
  });

  it('borne un contrôleur sans département à ses propres contrôles', async () => {
    const { service, prisma } = preparer();
    prisma.controle.findMany = jest.fn().mockResolvedValue([]);
    prisma.controle.count = jest.fn().mockResolvedValue(0);
    await service.liste({ controleurId: 'autre' } as any, CONTROLEUR);
    expect(prisma.controle.findMany.mock.calls[0][0].where.controleurId).toBe(CONTROLEUR.id);
    expect(prisma.controle.findMany.mock.calls[0][0].where.seance).not.toHaveProperty('affectation');

    prisma.controle.findFirst.mockResolvedValue(null);
    await expect(service.findOne('controle-autre', CONTROLEUR)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.controle.findFirst.mock.calls[0][0].where).toEqual({
      id: 'controle-autre',
      controleurId: CONTROLEUR.id,
    });
  });

  it.each([enseignant, chef])('refuse un contrôle hors périmètre même avec son identifiant', async (user) => {
    const { service, prisma } = preparer();
    prisma.controle.findFirst.mockResolvedValue(null);
    await expect(service.findOne('controle-autre', user)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.controle.findFirst.mock.calls[0][0].where.id).toBe('controle-autre');
  });
});

describe('QR de salle — projection et périmètre', () => {
  it('ne renvoie pas le jeton du QR et ne liste que les séances du jour du département du chef', async () => {
    const { service, prisma } = preparer();
    const chef: AuthUser = { ...CONTROLEUR, role: Role.CHEF_DEPARTEMENT, departementId: 'dept-1' };
    prisma.salle.findUnique.mockResolvedValue({ id: 'salle-1', code: 'A1', nom: 'Amphi A', actif: true });
    const result = await service.parQrSalle('secret-qr', chef);
    expect(prisma.salle.findUnique).toHaveBeenCalledWith({
      where: { qrToken: 'secret-qr' },
      select: { id: true, code: true, nom: true, actif: true },
    });
    expect(result.salle).not.toHaveProperty('qrToken');
    expect(prisma.seance.findMany.mock.calls[0][0].where).toMatchObject({
      salleId: 'salle-1',
      date: expect.any(Date),
      affectation: { enseignant: { departementId: 'dept-1' } },
    });
    expect(prisma.seance.findMany.mock.calls[0][0].select.controle.select).toEqual({ id: true });
  });

  it('limite les séances du QR au département du contrôleur connecté', async () => {
    const { service, prisma } = preparer();
    prisma.salle.findUnique.mockResolvedValue({ id: 'salle-1', code: 'A1', nom: 'Amphi A', actif: true });
    await service.parQrSalle('secret-qr', { ...CONTROLEUR, departementId: 'dept-1' });
    expect(prisma.seance.findMany.mock.calls[0][0].where).toMatchObject({
      salleId: 'salle-1',
      affectation: { enseignant: { departementId: 'dept-1' } },
    });
  });

  it('limite le scan d’un contrôleur sans département à ses séances attribuées', async () => {
    const { service, prisma } = preparer();
    prisma.salle.findUnique.mockResolvedValue({ id: 'salle-1', code: 'A1', nom: 'Amphi A', actif: true });
    await service.parQrSalle('secret-qr', CONTROLEUR);
    expect(prisma.seance.findMany.mock.calls[0][0].where).toMatchObject({
      salleId: 'salle-1',
      OR: [{ controleurAssigneId: CONTROLEUR.id }, { controle: { is: { controleurId: CONTROLEUR.id } } }],
    });
  });
});

describe('ControleService — journal de corrections', () => {
  it('conserve les valeurs avant/après sans les preuves biométriques', async () => {
    const { service, prisma } = preparer();
    prisma.controle.findUnique.mockResolvedValue({
      id: 'c1',
      controleurId: CONTROLEUR.id,
      statut: 'ABSENT',
      dureeMinutes: 0,
      signatureBase64: 'secret-signature',
      empreinteTemplate: 'secret-template',
    });
    await service.pointer({ seanceId: 'seance-1', heureArrivee: '08:10', heureFinReelle: '09:55' }, CONTROLEUR);
    const details = JSON.parse(prisma.auditLog.create.mock.calls[0][0].data.details);
    expect(details.avant.statut).toBe('ABSENT');
    expect(details.apres.statut).toBe('PRESENT');
    expect(details.apres.dureeMinutes).toBe(105);
    expect(JSON.stringify(details)).not.toContain('secret');
  });
  it('applique ensemble les filtres acteur, action, entité et dates', async () => {
    const { service, prisma } = preparer();
    prisma.auditLog.findMany = jest.fn().mockResolvedValue([]);
    prisma.auditLog.count = jest.fn().mockResolvedValue(0);
    await service.audit({
      entite: 'Controle',
      action: 'POINTAGE_CORRECTION',
      userId: 'actor',
      acteur: 'Diallo',
      dateDebut: '2026-01-01T00:00:00Z',
      dateFin: '2026-02-01T00:00:00Z',
    });
    const where = prisma.auditLog.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      entite: 'Controle',
      action: 'POINTAGE_CORRECTION',
      userId: 'actor',
      user: {
        OR: [
          { nom: { contains: 'Diallo', mode: 'insensitive' } },
          { prenom: { contains: 'Diallo', mode: 'insensitive' } },
        ],
      },
      createdAt: {
        gte: new Date('2026-01-01T00:00:00Z'),
        lte: new Date('2026-02-01T23:59:59.999Z'),
      },
    });
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where });
  });

  it('expose le résumé d’un lot SMS et masque tout champ inattendu', async () => {
    const { service, prisma } = preparer();
    prisma.auditLog.findMany = jest.fn().mockResolvedValue([
      {
        action: 'SMS_DIFFUSION_DEMANDEE',
        details: JSON.stringify({
          lotId: '00000000-0000-4000-8000-000000000001',
          canal: 'SMS',
          statutInitial: 'EN_ATTENTE',
          nombreDestinataires: 3,
          messagesPresents: 2,
          telephone: '+224620000000',
          destinataireNom: 'Nom privé',
          message: 'Contenu privé',
          reponseFournisseur: 'secret',
        }),
      },
    ]);
    prisma.auditLog.count = jest.fn().mockResolvedValue(1);

    const result = await service.audit({} as any);

    expect(JSON.parse(result.data[0].details)).toEqual({
      lotId: '00000000-0000-4000-8000-000000000001',
      canal: 'SMS',
      statutInitial: 'EN_ATTENTE',
      nombreDestinataires: 3,
      messagesPresents: 2,
    });
    expect(JSON.stringify(result)).not.toMatch(/\+224620000000|Nom privé|Contenu privé|secret/);
  });

  it('masque un résumé SMS mal formé au lieu de le publier', async () => {
    const { service, prisma } = preparer();
    prisma.auditLog.findMany = jest.fn().mockResolvedValue([
      {
        action: 'SMS_DIFFUSION_DEMANDEE',
        details: JSON.stringify({
          lotId: '00000000-0000-4000-8000-000000000001',
          canal: 'SMS',
          statutInitial: 'EN_ATTENTE',
          nombreDestinataires: 51,
          messagesPresents: 0,
          telephone: '+224620000000',
        }),
      },
    ]);
    prisma.auditLog.count = jest.fn().mockResolvedValue(1);

    const result = await service.audit({} as any);

    expect(result.data[0].details).toBe('[détails masqués]');
    expect(JSON.stringify(result)).not.toContain('+224620000000');
  });

  it('masque les anciens motifs médicaux et jetons QR dans les lignes du journal', async () => {
    const { service, prisma } = preparer();
    prisma.auditLog.findMany = jest.fn().mockResolvedValue([
      {
        action: 'POINTAGE_CORRECTION',
        ip: '198.51.100.42',
        details: JSON.stringify({
          avant: { statut: 'ABSENT', observation: 'Absence justifiée (MALADIE) : diagnostic privé' },
          apres: { statut: 'EXCUSE', observation: 'Absence justifiée (MALADIE) : diagnostic privé' },
        }),
      },
      { action: 'PATRIMOINE_QR_REGENERE', details: 'PAT-001 — UP-PAT-SECRET' },
      { action: 'RESERVATION_CREEE', details: 'Conseil médical — traitement confidentiel' },
      { action: 'DEMANDE_DOC_REJETEE', details: 'DD-01 — rejet : diagnostic privé' },
      { action: 'ETUDIANT_CREE', details: 'MAT-01 — Nom Prénom' },
      { action: 'PLAGIAT_ACQUITTE', details: 'Mémoire sensible : commentaire privé' },
      { action: 'EXAMEN_SCAN_REJETE', details: 'EX-01 — référence scannée privée' },
      {
        action: 'ATTESTATION_MODIFICATION',
        details: JSON.stringify({
          avant: { id: 'att-1', motif: 'usage avant privé' },
          apres: { id: 'att-1', motif: 'usage après privé' },
        }),
      },
      {
        action: 'ATTRIBUTION_RETIREE',
        details: JSON.stringify({
          motif: 'motif de retrait privé',
          avant: { id: 'log-1', retireeMotif: null },
          apres: { id: 'log-1', retireeMotif: 'donnée privée' },
        }),
      },
    ]);
    prisma.auditLog.count = jest.fn().mockResolvedValue(9);

    const result = await service.audit({} as any);

    expect(JSON.parse(result.data[0].details)).toEqual({
      avant: { statut: 'ABSENT' },
      apres: { statut: 'EXCUSE' },
    });
    expect(result.data[1].details).toBe('QR régénéré');
    expect(result.data.slice(2, 7).every((ligne: any) => ligne.details === '[détails masqués]')).toBe(true);
    expect(JSON.parse(result.data[7].details)).toEqual({ avant: { id: 'att-1' }, apres: { id: 'att-1' } });
    expect(JSON.parse(result.data[8].details)).toEqual({ avant: { id: 'log-1' }, apres: { id: 'log-1' } });
    expect(JSON.stringify(result)).not.toMatch(
      /diagnostic privé|usage avant privé|usage après privé|donnée privée|UP-PAT-SECRET|référence scannée privée|198\.51\.100\.42/,
    );
  });

  it('masque les détails de paie pour ne pas exposer les rémunérations dans le Journal', async () => {
    const { service, prisma } = preparer();
    prisma.auditLog.findMany = jest.fn().mockResolvedValue([
      {
        action: 'PAIE_RECALCULEE',
        details: JSON.stringify({
          avant: {
            montantTotal: 120000,
            lignes: [{ enseignantId: 'enseignant-1', tauxHoraire: 5000, montantBrut: 120000 }],
          },
          apres: {
            montantTotal: 108000,
            lignes: [{ enseignantId: 'enseignant-1', tauxHoraire: 5000, retenue: 12000, montantNet: 108000 }],
          },
        }),
      },
    ]);
    prisma.auditLog.count = jest.fn().mockResolvedValue(1);

    const result = await service.audit({} as any);

    expect(result.data[0].details).toBe('[détails masqués]');
    expect(JSON.stringify(result)).not.toMatch(/120000|108000|5000|enseignant-1/);
  });

  it('masque les anciennes descriptions de ticket et expose seulement la nouvelle projection', async () => {
    const { service, prisma } = preparer();
    prisma.auditLog.findMany = jest.fn().mockResolvedValue([
      { action: 'TICKET_OUVERT', details: 'TCK-1 — PLOMBERIE : description confidentielle' },
      {
        action: 'TICKET_OUVERT',
        details: JSON.stringify({
          avant: null,
          apres: { id: 'ticket-1', numero: 'TCK-2', statut: 'OUVERT', descriptionFournie: true },
        }),
      },
    ]);
    prisma.auditLog.count = jest.fn().mockResolvedValue(2);

    const result = await service.audit({} as any);

    expect(result.data[0].details).toBe('[détails masqués]');
    expect(JSON.parse(result.data[1].details)).toEqual({
      avant: null,
      apres: { id: 'ticket-1', numero: 'TCK-2', statut: 'OUVERT', descriptionFournie: true },
    });
    expect(JSON.stringify(result)).not.toContain('description confidentielle');
  });

  it('masque les anciens textes de réclamation et expose la projection sans contenu libre', async () => {
    const { service, prisma } = preparer();
    prisma.auditLog.findMany = jest.fn().mockResolvedValue([
      { action: 'RECLAMATION_OUVERTE', details: 'Réclamation de Awa : diagnostic médical confidentiel' },
      {
        action: 'RECLAMATION_OUVERTE',
        details: JSON.stringify({
          avant: null,
          apres: { id: 'rec-2', numero: 'REC-2026-00002', statut: 'OUVERT', sujetFourni: true },
        }),
      },
    ]);
    prisma.auditLog.count = jest.fn().mockResolvedValue(2);

    const result = await service.audit({} as any);

    expect(result.data[0].details).toBe('[détails masqués]');
    expect(JSON.parse(result.data[1].details)).toEqual({
      avant: null,
      apres: { id: 'rec-2', numero: 'REC-2026-00002', statut: 'OUVERT', sujetFourni: true },
    });
    expect(JSON.stringify(result)).not.toContain('diagnostic médical confidentiel');
  });

  it('masque les anciens détails de plagiat et n’expose que le nouvel état projeté', async () => {
    const { service, prisma } = preparer();
    prisma.auditLog.findMany = jest.fn().mockResolvedValue([
      { action: 'PLAGIAT_ACQUITTE', details: 'Mémoire sensible : commentaire privé' },
      {
        action: 'PLAGIAT_CONFIRME',
        details: JSON.stringify({
          avant: { id: 'susp-1', statut: 'EN_ATTENTE', commentaireFourni: false },
          apres: { id: 'susp-1', statut: 'CONFIRME', commentaireFourni: true },
          champsModifies: ['statut', 'commentaire'],
        }),
      },
    ]);
    prisma.auditLog.count = jest.fn().mockResolvedValue(2);

    const result = await service.audit({} as any);

    expect(result.data[0].details).toBe('[détails masqués]');
    expect(JSON.parse(result.data[1].details)).toEqual({
      avant: { id: 'susp-1', statut: 'EN_ATTENTE', commentaireFourni: false },
      apres: { id: 'susp-1', statut: 'CONFIRME', commentaireFourni: true },
      champsModifies: ['statut'],
    });
    expect(JSON.stringify(result)).not.toMatch(/commentaire privé|Mémoire sensible/);
  });

  it('masque les reçus historiques de vote et le compte de l’électeur', async () => {
    const { service, prisma } = preparer();
    prisma.auditLog.findMany = jest.fn().mockResolvedValue([
      {
        action: 'VOTE_DEPOSE',
        user: { nom: 'Électeur privé', prenom: 'Nom' },
        details: 'jeton-de-scrutin',
      },
      {
        action: 'ELECTION_OUVERTE',
        user: null,
        details: '{"avant":{"statut":"BROUILLON"},"apres":{"statut":"OUVERT"}}',
      },
    ]);
    prisma.auditLog.count = jest.fn().mockResolvedValue(1);

    const result = await service.audit({} as any);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].action).toBe('ELECTION_OUVERTE');
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: { not: 'VOTE_DEPOSE' } }),
      }),
    );
    expect(prisma.auditLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: { not: 'VOTE_DEPOSE' } }),
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/VOTE_DEPOSE|Électeur privé|jeton-de-scrutin/);
  });

  it('ne révèle pas les votes historiques quand VOTE_DEPOSE est demandé comme filtre', async () => {
    const { service, prisma } = preparer();
    prisma.auditLog.findMany = jest.fn().mockResolvedValue([]);
    prisma.auditLog.count = jest.fn().mockResolvedValue(0);

    const result = await service.audit({ action: 'VOTE_DEPOSE' } as any);

    const where = prisma.auditLog.findMany.mock.calls[0][0].where;
    expect(where.action).toBe('__ACTION_DE_VOTE_NON_AFFICHABLE__');
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where });
    expect(result.total).toBe(0);
  });

  it('inclut toute la journée de dateFin dans le journal d’audit', async () => {
    const prisma: any = {
      auditLog: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    const service = new ControleService(prisma, {} as any, {} as any);

    await service.audit({ dateDebut: '2026-10-01', dateFin: '2026-10-03' } as any);

    expect(prisma.auditLog.findMany.mock.calls[0][0].where.createdAt).toEqual({
      gte: new Date('2026-10-01T00:00:00.000Z'),
      lte: new Date('2026-10-03T23:59:59.999Z'),
    });
  });
});

describe('ControleService — correction d’un pointage', () => {
  const EXISTANT = {
    id: 'c1',
    seanceId: 'seance-1',
    controleurId: 'user-1',
    statut: StatutPresence.RETARD,
    heureArrivee: '08:20',
    heureFinReelle: '09:15',
    dureeMinutes: 55,
    effectifPresent: 42,
    thematiqueTraitee: 'Chapitre 3',
    observation: 'Retard de 10 minutes',
    signatureBase64: 'data:image/png;base64,AAA',
    attestation: 'SIGNATURE',
    attestationValide: true,
    attestationLe: new Date('2026-01-06T08:20:00.000Z'),
    empreinteScore: null,
    methode: 'QR_SALLE',
    qrSalleValide: true,
    latitude: 9.5335,
    longitude: -13.6875,
    distanceMetres: 12,
    enseignantRemplacantId: null,
    horsLigne: false,
    horodatage: new Date('2026-01-06T08:20:00.000Z'),
  };

  function preparerCorrection(parametres: Record<string, unknown> = {}) {
    const { service, prisma, attestation } = preparer({
      parametres: { ATTESTATION_OBLIGATOIRE: true, EFFECTIF_OBLIGATOIRE: true, ...parametres },
    });
    prisma.controle.findFirst.mockResolvedValue(EXISTANT);
    prisma.controle.findUnique.mockResolvedValue(EXISTANT);
    return { service, prisma, attestation };
  }

  it('ne change que les champs transmis', async () => {
    const { service, prisma } = preparerCorrection();

    await service.modifier('c1', { observation: 'Retard excusé' }, CONTROLEUR, '10.0.0.1');

    const data = prisma.controle.update.mock.calls[0][0].data;
    expect(data.observation).toBe('Retard excusé');
    expect(data.effectifPresent).toBe(42);
    expect(data.heureArrivee).toBe('08:20');
    expect(data.heureFinReelle).toBe('09:15');
    expect(data.thematiqueTraitee).toBe('Chapitre 3');
    expect(data.statut).toBe(StatutPresence.RETARD);
  });

  it('conserve l’attestation déjà donnée et n’en exige pas une nouvelle', async () => {
    const { service, prisma, attestation } = preparerCorrection();

    await service.modifier('c1', { effectifPresent: 40 }, CONTROLEUR, '10.0.0.1');

    const data = prisma.controle.update.mock.calls[0][0].data;
    expect(data.attestation).toBe('SIGNATURE');
    expect(data.attestationValide).toBe(true);
    expect(data.effectifPresent).toBe(40);
    // Aucune preuve n'est demandée à l'enseignant : la correction ne rejoue pas
    // la saisie.
    expect(attestation.verifierPreuves).not.toHaveBeenCalled();
  });

  it('conserve la méthode de vérification et l’horodatage d’origine', async () => {
    const { service, prisma } = preparerCorrection();

    await service.modifier('c1', { observation: 'Rectificatif' }, CONTROLEUR, '10.0.0.1');

    const data = prisma.controle.update.mock.calls[0][0].data;
    expect(data.methode).toBe('QR_SALLE');
    expect(data.qrSalleValide).toBe(true);
    expect(data.horodatage).toEqual(EXISTANT.horodatage);
  });

  it('journalise la correction', async () => {
    const { service, prisma } = preparerCorrection();

    await service.modifier('c1', { observation: 'Rectificatif' }, CONTROLEUR, '10.0.0.1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'POINTAGE_CORRECTION' }) }),
    );
  });

  it('refuse la correction d’un pointage fait par un autre agent', async () => {
    const { service } = preparerCorrection();

    await expect(service.modifier('c1', { observation: 'X' }, { ...CONTROLEUR, id: 'user-9' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
