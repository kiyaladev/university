import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role, StatutExamen } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import type { AuthUser } from '../../common/decorators';
import { ExamensService } from './examens.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Périmètre des examens et scans', () => {
  const controleur = { id: 'ctrl-1', role: Role.CONTROLEUR } as AuthUser;
  const admin = { id: 'admin-1', role: Role.ADMIN } as AuthUser;
  const examen = { id: 'exam-1', anneeId: 'year-1', surveillantId: 'ctrl-1', statut: StatutExamen.EN_COURS };
  const prepare = () => {
    const db: any = {
      examen: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(examen),
        create: jest.fn(),
      },
      $transaction: jest.fn((operation: (tx: any) => unknown) => operation(db)),
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'year-1', cloturee: false }) },
      promotion: { findUnique: jest.fn().mockResolvedValue({ anneeId: 'year-1' }) },
      scanExamen: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1234),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'scan-1' }),
      },
      etudiant: { findUnique: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn() },
    };
    return { db, service: new ExamensService(db) };
  };

  it('force la liste à l’examen attribué au contrôleur', async () => {
    const { db, service } = prepare();
    await service.liste({} as any, controleur);
    expect(db.examen.findMany.mock.calls[0][0].where.surveillantId).toBe(controleur.id);
    expect(db.examen.count.mock.calls[0][0].where.surveillantId).toBe(controleur.id);
  });

  it('masque un examen hors affectation en accès direct', async () => {
    const { db, service } = prepare();
    db.examen.findUnique.mockResolvedValue({ ...examen, surveillantId: 'ctrl-2' });
    await expect(service.trouver(examen.id, controleur)).rejects.toThrow(NotFoundException);
  });

  it('ne renvoie que les champs étudiants nécessaires au registre de scan', async () => {
    const { db, service } = prepare();
    const resultat = await service.listeScans(examen.id, { pageSize: 10000 } as any, admin);
    expect(db.scanExamen.findMany.mock.calls[0][0].include.inscription.select.etudiant.select).toEqual({
      id: true, matricule: true, nom: true, prenom: true,
    });
    expect(db.scanExamen.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 1000 });
    expect(resultat).toEqual({ data: [], total: 1234, page: 1, pageSize: 1000 });
  });

  it('attribue le scan à la session courante, jamais à l’identifiant fourni par le client', async () => {
    const { db, service } = prepare();
    await service.scanner({ examenId: examen.id, reference: 'inconnue', scanneurId: 'spoofed-user' } as any, undefined, controleur);
    expect(db.scanExamen.create.mock.calls[0][0].data.scanneurId).toBe(controleur.id);
  });

  it('relit l’état de l’examen dans la transaction avant de consigner un rejet', async () => {
    const { db, service } = prepare();
    db.$queryRaw = jest.fn(async (requete: TemplateStringsArray) => {
      const sql = requete.join(' ');
      if (sql.includes('FROM "AnneeAcademique"')) return [{ cloturee: false }];
      if (sql.includes('FROM "Examen"')) return [{
        anneeId: examen.anneeId, statut: StatutExamen.TERMINE, surveillantId: examen.surveillantId,
      }];
      return [];
    });

    await expect(service.scanner(
      { examenId: examen.id, reference: 'inconnue' } as any, undefined, controleur,
    )).rejects.toThrow('examens.scan_exige_examen_en_cours');

    expect(db.scanExamen.create).not.toHaveBeenCalled();
  });

  it('refuse les scans tant que l’examen est planifié', async () => {
    const { db, service } = prepare();
    db.examen.findUnique.mockResolvedValue({ ...examen, statut: StatutExamen.PLANIFIE });
    await expect(service.scanner(
      { examenId: examen.id, reference: 'inconnue' } as any, undefined, controleur,
    )).rejects.toThrow('examens.scan_exige_examen_en_cours');
    expect(db.scanExamen.create).not.toHaveBeenCalled();
  });

  it('masque un jeton QR resto même si la référence reçue est en minuscules', async () => {
    const { db, service } = prepare();
    await service.scanner(
      { examenId: examen.id, reference: 'up-resto-secret' } as any, undefined, controleur,
    );
    expect(db.scanExamen.create.mock.calls[0][0].data.matriculeSaisi).toBe('[QR masqué]');
  });

  it('verrouille la ligne examen pendant l’écriture d’un scan', async () => {
    const { db, service } = prepare();
    db.$queryRaw = jest.fn(async (requete: TemplateStringsArray) => {
      const sql = requete.join(' ');
      if (sql.includes('FROM "AnneeAcademique"')) return [{ cloturee: false }];
      if (sql.includes('FROM "Examen"')) return [{
        anneeId: examen.anneeId, statut: examen.statut, surveillantId: examen.surveillantId,
      }];
      return [];
    });

    await service.scanner({ examenId: examen.id, reference: 'inconnue' } as any, undefined, controleur);

    expect(db.$queryRaw.mock.calls.some(([requete]: [TemplateStringsArray]) =>
      requete.join(' ').includes('FROM "Examen"') && requete.join(' ').includes('FOR UPDATE'),
    )).toBe(true);
  });

  it('refuse la création et les scans rattachés à une année clôturée', async () => {
    const { db, service } = prepare();
    db.anneeAcademique.findUnique.mockResolvedValue({ id: 'year-1', cloturee: true });
    await expect(service.creer({ anneeId: 'year-1' } as any, admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.scanner({ examenId: examen.id, reference: '123' } as any, undefined, controleur))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(db.examen.create).not.toHaveBeenCalled();
    expect(db.scanExamen.create).not.toHaveBeenCalled();
  });

  it('refuse un examen dont la promotion appartient à une autre année', async () => {
    const { db, service } = prepare();
    db.promotion.findUnique.mockResolvedValue({ anneeId: 'year-2' });
    await expect(service.creer({ anneeId: 'year-1', promotionId: 'promo-1' } as any, admin))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(db.examen.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
