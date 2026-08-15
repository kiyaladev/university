/** Règles de pointage : déduction du statut, durée effective, preuves. */
import { BadRequestException } from '@nestjs/common';
import { Role, StatutPresence, StatutSeance } from '@prisma/client';
import { ControleService } from './controle.service';
import { AuthUser } from '../../common/decorators';

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
  statut: StatutSeance.PLANIFIEE,
  heureDebut: '08:00',
  heureFin: '10:00',
  salle: {
    id: 'salle-1',
    qrToken: 'UP-salle-1',
    latitude: 9.5335,
    longitude: -13.6875,
    rayonMetres: 80,
  },
  affectation: { id: 'aff-1', enseignantId: 'ens-1' },
};

function preparer(options: { parametres?: Record<string, unknown>; seance?: any } = {}) {
  const prisma = {
    seance: {
      findUnique: jest.fn().mockResolvedValue(options.seance ?? SEANCE),
      update: jest.fn().mockResolvedValue({}),
    },
    controle: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'c1', ...create })),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;

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
    const controle: any = await service.pointer(
      { seanceId: 'seance-1', heureArrivee: '08:45' },
      CONTROLEUR,
    );
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
    const controle: any = await service.pointer(
      { seanceId: 'seance-1', statut: StatutPresence.PRESENT },
      CONTROLEUR,
    );
    expect(controle.dureeMinutes).toBe(120);
  });

  it('applique la tolérance paramétrée par l’établissement', async () => {
    const { service } = preparer({ parametres: { TOLERANCE_RETARD_MIN: 30 } });
    const controle: any = await service.pointer(
      { seanceId: 'seance-1', heureArrivee: '08:25' },
      CONTROLEUR,
    );
    expect(controle.statut).toBe(StatutPresence.PRESENT);
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
    await expect(
      service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05' }, CONTROLEUR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une position hors du rayon de la salle si la géolocalisation est exigée', async () => {
    const { service } = preparer({ parametres: { GEOLOC_OBLIGATOIRE: true } });
    await expect(
      service.pointer(
        { seanceId: 'seance-1', heureArrivee: '08:05', latitude: 9.55, longitude: -13.6875 },
        CONTROLEUR,
      ),
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
    await expect(
      service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05' }, CONTROLEUR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse le pointage d’un enseignant présent sans aucune attestation', async () => {
    const { service } = preparer({ parametres: { ATTESTATION_OBLIGATOIRE: true } });
    await expect(
      service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05' }, CONTROLEUR),
    ).rejects.toBeInstanceOf(BadRequestException);
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
      service.pointer(
        { seanceId: 'seance-1', heureArrivee: '08:05', codePinEnseignant: '1234' },
        CONTROLEUR,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse de pointer une séance annulée', async () => {
    const { service } = preparer({ seance: { ...SEANCE, statut: StatutSeance.ANNULEE } });
    await expect(
      service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05' }, CONTROLEUR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('met la séance à jour et journalise le pointage', async () => {
    const { service, prisma } = preparer();
    await service.pointer({ seanceId: 'seance-1', heureArrivee: '08:05' }, CONTROLEUR, '10.0.0.1');

    expect(prisma.seance.update).toHaveBeenCalledWith({
      where: { id: 'seance-1' },
      data: { statut: StatutSeance.CONTROLEE },
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
    prisma.seance.findUnique
      .mockResolvedValueOnce(SEANCE)
      .mockResolvedValueOnce(null); // deuxième séance inconnue

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
