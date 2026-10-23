import { Role } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import type { AuthUser } from '../../../common/decorators';
import { ImportCsvDto, TypeImportReferentiel } from './imports.dto';
import { ImportsService } from './imports.service';

describe('imports CSV de référentiels', () => {
  const user = { id: 'sco-1', role: Role.SCOLARITE } as AuthUser;
  const prepare = () => {
    const prisma: any = {
      enseignant: { findFirst: jest.fn().mockResolvedValue(null) },
      matiere: { findFirst: jest.fn().mockResolvedValue(null) },
      salle: { findFirst: jest.fn().mockResolvedValue(null) },
      creneau: { findFirst: jest.fn().mockResolvedValue(null) },
      departement: { findUnique: jest.fn().mockResolvedValue({ id: 'dept-1' }) },
      affectation: { findUnique: jest.fn().mockResolvedValue({ id: 'aff-1' }) },
    };
    const enseignants: any = { creerPour: jest.fn().mockResolvedValue({ id: 'teacher-1' }) };
    const matieres: any = { create: jest.fn() };
    const salles: any = { creer: jest.fn() };
    const creneaux: any = { creer: jest.fn(), verifierImport: jest.fn() };
    return {
      prisma,
      enseignants,
      matieres,
      salles,
      creneaux,
      service: new ImportsService(prisma, enseignants, matieres, salles, creneaux),
    };
  };
  const dto = (contenu: string): ImportCsvDto => ({ type: TypeImportReferentiel.ENSEIGNANTS, contenu });

  it.each(['non', 'false', '0', 'no'])('importe actif=%s comme false', async (valeur) => {
    const { service, enseignants } = prepare();
    await service.importer(dto(`matricule;nom;prenom;actif\nT-01;Bah;Awa;${valeur}`), user);
    expect(enseignants.creerPour).toHaveBeenCalledWith(expect.objectContaining({ actif: false }), user);
  });

  it('rejette un booléen CSV inconnu plutôt que de le convertir en true', async () => {
    const { service } = prepare();
    const resultat = await service.previsualiser(dto('matricule;nom;prenom;actif\nT-01;Bah;Awa;peut-être'));
    expect(resultat).toMatchObject({ valides: 0, rejetees: 1 });
  });

  it('prévisualise les accents et rejette doublons internes et existants ligne par ligne', async () => {
    const { prisma, service } = prepare();
    prisma.enseignant.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.matricule.equals.toLocaleUpperCase('fr') === 'T-03' ? { id: 'old' } : null),
    );
    const resultat = await service.previsualiser(
      dto('Matricule;Nom;Prénom\nT-01;Bah;Awa\nT-02;Camara;Moussa\nT-02;Diallo;Mariam\nt-03;Keita;Fanta'),
    );
    expect(resultat).toMatchObject({ lignesLues: 4, valides: 2, rejetees: 2 });
    expect(resultat.erreurs.map((e) => e.numero)).toEqual([4, 5]);
    expect(resultat.erreurs[0].erreurs[0]).toContain('Doublon dans le fichier');
    expect(resultat.erreurs[1].erreurs[0]).toContain('existe déjà');
  });

  it('applique les lignes valides sans abandonner les erreurs des autres', async () => {
    const { prisma, enseignants, service } = prepare();
    prisma.enseignant.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.matricule.equals === 'T-02' ? { id: 'old' } : null),
    );
    const resultat = await service.importer(
      dto('matricule;nom;prenom\nT-01;Bah;Awa\nT-02;Camara;Moussa\n;Sans;Matricule'),
      user,
    );
    expect(resultat).toMatchObject({ lignesLues: 3, importees: 1, rejetees: 2 });
    expect(enseignants.creerPour).toHaveBeenCalledTimes(1);
    expect(enseignants.creerPour).toHaveBeenCalledWith(expect.objectContaining({ matricule: 'T-01' }), user);
    expect(resultat.erreurs.map((e) => e.numero)).toEqual([3, 4]);
  });

  it('refuse un fichier dont une colonne obligatoire est absente', async () => {
    const { service } = prepare();
    await expect(service.previsualiser(dto('matricule;nom\nT-01;Bah'))).rejects.toThrow(
      'Colonnes obligatoires absentes',
    );
  });

  it('signale explicitement les colonnes non reconnues qui seraient sinon ignorées', async () => {
    const { service } = prepare();
    const resultat = await service.previsualiser(dto('matricule;nom;prenom;Département\nT-01;Bah;Awa;D-1'));
    expect(resultat.valides).toBe(1);
    expect(resultat.colonnesIgnorees).toEqual(['Département']);
  });

  it('normalise un décimal français avant validation', async () => {
    const { prisma, service } = prepare();
    const resultat = await service.previsualiser({
      type: TypeImportReferentiel.ENSEIGNANTS,
      contenu: 'matricule;nom;prenom;taux horaire\nT-01;Bah;Awa;1250,5',
    });
    expect(resultat.valides).toBe(1);
    expect(prisma.enseignant.findFirst).toHaveBeenCalledWith({
      where: { matricule: { equals: 'T-01', mode: 'insensitive' } },
      select: { id: true },
    });
  });

  it('normalise les nombres français avec séparateurs de milliers avant validation', async () => {
    const { service } = prepare();
    const resultat = await service.previsualiser({
      type: TypeImportReferentiel.ENSEIGNANTS,
      contenu: 'matricule;nom;prenom;taux horaire\nT-01;Bah;Awa;1 250,50 €',
    });
    expect(resultat.valides).toBe(1);
    expect(resultat.erreurs).toEqual([]);
  });

  it('normalise les jours, heures, types et dates issus d’un planning français', async () => {
    const { prisma, creneaux, service } = prepare();
    prisma.affectation.findUnique.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001' });
    creneaux.verifierImport.mockResolvedValue(undefined);
    const resultat = await service.previsualiser({
      type: TypeImportReferentiel.CRENEAUX,
      contenu:
        'Affectation ID;Jour de la semaine;Heure de début;Heure de fin;Type de cours;Date de début\n00000000-0000-4000-8000-000000000001;Lundi;8h00;10:00;Travaux dirigés;05/10/26',
    });
    expect(resultat.valides).toBe(1);
    expect(creneaux.verifierImport).toHaveBeenCalledWith(
      expect.objectContaining({
        jourSemaine: 1,
        heureDebut: '08:00',
        heureFin: '10:00',
        type: 'TD',
        dateDebut: '2026-10-05',
      }),
    );
  });

  it('signale un identifiant de département inexistant avant la création', async () => {
    const { prisma, service } = prepare();
    prisma.departement.findUnique.mockResolvedValue(null);
    const resultat = await service.previsualiser({
      type: TypeImportReferentiel.MATIERES,
      contenu: 'code;intitule;departementId\nM1;Analyse;00000000-0000-4000-8000-000000000001',
    });
    expect(resultat.valides).toBe(0);
    expect(resultat.erreurs[0].erreurs[0]).toContain('département indiqué n’existe pas');
  });

  it('utilise la validation métier des collisions de créneaux pendant l’aperçu', async () => {
    const { creneaux, service } = prepare();
    creneaux.verifierImport.mockRejectedValue(new BadRequestException('Conflit de salle'));
    const resultat = await service.previsualiser({
      type: TypeImportReferentiel.CRENEAUX,
      contenu: 'affectationId;jourSemaine;heureDebut;heureFin\n00000000-0000-4000-8000-000000000001;1;08:00;10:00',
    });
    expect(resultat.valides).toBe(0);
    expect(resultat.erreurs[0].erreurs).toContain('Conflit de salle');
    expect(creneaux.creer).not.toHaveBeenCalled();
  });

  it('attribue le créneau importé à l’utilisateur qui a lancé l’import', async () => {
    const { prisma, creneaux, service } = prepare();
    prisma.affectation.findUnique.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001' });
    creneaux.verifierImport.mockResolvedValue(undefined);

    const resultat = await service.importer(
      {
        type: TypeImportReferentiel.CRENEAUX,
        contenu: 'affectationId;jourSemaine;heureDebut;heureFin\n00000000-0000-4000-8000-000000000001;1;08:00;10:00',
      },
      user,
    );

    expect(resultat).toMatchObject({ importees: 1, rejetees: 0 });
    expect(creneaux.creer).toHaveBeenCalledWith(
      expect.objectContaining({
        affectationId: '00000000-0000-4000-8000-000000000001',
        jourSemaine: 1,
      }),
      user,
    );
  });

  it('normalise les dates de créneau pour le contrôle des doublons en base', async () => {
    const { prisma, service } = prepare();
    await service.previsualiser({
      type: TypeImportReferentiel.CRENEAUX,
      contenu:
        'affectationId;jourSemaine;heureDebut;heureFin;dateDebut;dateFin\n00000000-0000-4000-8000-000000000001;1;08:00;10:00;2026-10-05;2026-12-20',
    });
    expect(prisma.creneau.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dateDebut: expect.any(Date), dateFin: expect.any(Date) }),
      }),
    );
  });
});
