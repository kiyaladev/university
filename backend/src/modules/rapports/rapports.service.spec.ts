import { BadRequestException } from '@nestjs/common';
import { RapportsService } from './rapports.service';

describe('bornes temporelles des rapports', () => {
  it('limite un rapport sans période aux 30 derniers jours', async () => {
    const prisma: any = { seance: { findMany: jest.fn().mockResolvedValue([]) } };
    await new RapportsService(prisma).presenceEnseignants({} as any);

    const periode = prisma.seance.findMany.mock.calls[0][0].where.date;
    expect(periode.gte).toBeInstanceOf(Date);
    expect(periode.lte).toBeInstanceOf(Date);
    expect(periode.lte.getTime() - periode.gte.getTime()).toBe(29 * 24 * 60 * 60 * 1000);
  });

  it('refuse les périodes inversées ou supérieures à un an avant la lecture', async () => {
    const prisma: any = { seance: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new RapportsService(prisma);

    await expect(
      service.presenceEnseignants({ dateDebut: '2026-10-10', dateFin: '2026-10-01' } as any),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.presenceEnseignants({ dateDebut: '2024-01-01', dateFin: '2026-01-01' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.seance.findMany).not.toHaveBeenCalled();
  });
});

describe('projection du registre de présence', () => {
  it('ne renvoie jamais la signature biométrique dans le rapport JSON', async () => {
    const seance = {
      id: 'seance-1',
      date: new Date('2026-10-03T00:00:00Z'),
      heureDebut: '08:00',
      heureFin: '10:00',
      type: 'COURS',
      thematique: 'Analyse',
      salle: { code: 'A1' },
      affectation: {
        enseignant: { nom: 'Barry', prenom: 'Awa', matricule: 'ENS-01' },
        matiere: { intitule: 'Mathématiques' },
        promotion: { nom: 'L1' },
      },
      controle: {
        statut: 'PRESENT',
        heureArrivee: '08:00',
        heureFinReelle: '10:00',
        dureeMinutes: 120,
        observation: 'donnée privée du contrôleur',
        signatureBase64: 'signature-biometrique-secrete',
      },
      justificatif: null,
    };
    const prisma: any = { seance: { findMany: jest.fn().mockResolvedValue([seance]) } };
    const service = new RapportsService(prisma);

    const registre = await service.registre({ date: '2026-10-03' } as any);

    expect(registre.lignes[0]).not.toHaveProperty('signatureBase64');
    expect(registre.lignes[0].observation).toBe('');
    expect(JSON.stringify(registre)).not.toContain('signature-biometrique-secrete');
    const include = prisma.seance.findMany.mock.calls[0][0].include;
    expect(include.controle.select).not.toHaveProperty('signatureBase64');
    expect(include.controle.select).not.toHaveProperty('observation');
    expect(include.affectation.include.enseignant.select).not.toHaveProperty('empreinteTemplate');
    expect(include.justificatif.select).toEqual({ statut: true });
  });

  it('réserve l’observation libre aux rôles de gestion', async () => {
    const seance = {
      id: 'seance-1',
      date: new Date('2026-10-03T00:00:00Z'),
      heureDebut: '08:00',
      heureFin: '10:00',
      type: 'COURS',
      thematique: 'Analyse',
      salle: { code: 'A1' },
      affectation: {
        enseignant: { nom: 'Barry', prenom: 'Awa', matricule: 'ENS-01' },
        matiere: { intitule: 'Mathématiques' },
        promotion: { nom: 'L1' },
      },
      controle: { statut: 'PRESENT', observation: 'incident privé' },
      justificatif: null,
    };
    const prisma: any = { seance: { findMany: jest.fn().mockResolvedValue([seance]) } };
    const service = new RapportsService(prisma);

    const registre = await service.registre({ date: '2026-10-03' } as any, false, true);

    expect(registre.lignes[0].observation).toBe('incident privé');
    expect(prisma.seance.findMany.mock.calls[0][0].include.controle.select.observation).toBe(true);
  });

  it('réserve les signatures à la génération interne du relevé PDF', async () => {
    const seance = {
      id: 'seance-1',
      date: new Date('2026-10-03T00:00:00Z'),
      heureDebut: '08:00',
      heureFin: '10:00',
      type: 'COURS',
      thematique: 'Analyse',
      salle: { code: 'A1' },
      affectation: {
        enseignant: { nom: 'Barry', prenom: 'Awa', matricule: 'ENS-01' },
        matiere: { intitule: 'Mathématiques' },
        promotion: { nom: 'L1' },
      },
      controle: { statut: 'PRESENT', signatureBase64: 'signature-biometrique-secrete' },
      justificatif: null,
    };
    const prisma: any = { seance: { findMany: jest.fn().mockResolvedValue([seance]) } };
    const service = new RapportsService(prisma);
    const registre = await service.registre({ date: '2026-10-03' } as any, true);
    expect(registre.lignes[0]).toHaveProperty('signatureBase64', 'signature-biometrique-secrete');
    expect(prisma.seance.findMany.mock.calls[0][0].include.controle.select.signatureBase64).toBe(true);
  });
});

describe('projection de la fiche de présence enseignant', () => {
  it('retourne une identité minimale sans coordonnées, rémunération ni données biométriques', async () => {
    const prisma: any = {
      enseignant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ens-1',
          matricule: 'ENS-01',
          nom: 'Barry',
          prenom: 'Awa',
          grade: 'MC',
          statut: 'PERMANENT',
          departementId: 'dep-1',
          departement: { id: 'dep-1', code: 'INFO', nom: 'Informatique', budget: 1000 },
          email: 'awa@example.gn',
          latitude: 10,
          tauxHoraire: 200000,
          empreinteTemplate: 'secret',
          codePin: '9876',
        }),
      },
      seance: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new RapportsService(prisma);

    const resultat = await service.ficheEnseignant('ens-1', {} as any);

    expect(prisma.enseignant.findUnique).toHaveBeenCalledWith({
      where: { id: 'ens-1' },
      select: {
        id: true,
        matricule: true,
        nom: true,
        prenom: true,
        grade: true,
        statut: true,
        departementId: true,
        departement: { select: { id: true, code: true, nom: true } },
      },
    });
    expect(resultat.enseignant).toEqual({
      id: 'ens-1',
      matricule: 'ENS-01',
      nom: 'Barry',
      prenom: 'Awa',
      grade: 'MC',
      statut: 'PERMANENT',
      departementId: 'dep-1',
      departement: { id: 'dep-1', code: 'INFO', nom: 'Informatique' },
    });
  });

  it('masque les observations libres dans la fiche sauf demande explicite de gestion', async () => {
    const seance = {
      id: 'seance-1',
      date: new Date('2026-10-03T00:00:00Z'),
      heureDebut: '08:00',
      heureFin: '10:00',
      affectation: { matiere: { intitule: 'Mathématiques' }, promotion: { nom: 'L1' } },
      controle: { observation: 'incident privé' },
    };
    const prisma: any = {
      enseignant: { findUnique: jest.fn().mockResolvedValue(null) },
      seance: { findMany: jest.fn().mockResolvedValue([seance]) },
    };
    const service = new RapportsService(prisma);

    const restreinte = await service.ficheEnseignant('ens-1', {} as any);
    const gestion = await service.ficheEnseignant('ens-1', {} as any, true);

    expect(restreinte.seances[0].observation).toBe('');
    expect(gestion.seances[0].observation).toBe('incident privé');
    expect(prisma.seance.findMany.mock.calls[0][0].include.controle.select).not.toHaveProperty('observation');
    expect(prisma.seance.findMany.mock.calls[1][0].include.controle.select.observation).toBe(true);
  });
});
