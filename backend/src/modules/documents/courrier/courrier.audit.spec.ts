/**
 * Journal avant/après du courrier — mutations sensibles et transitions de circuit.
 *
 * Ce que ces tests verrouillent :
 *  - l'acteur (compte connecté) et l'entité visée sont inscrits ;
 *  - l'état avant et après est complet sur l'identification, le statut et le
 *    circuit, sans la pièce jointe, l'objet, les correspondants, les notes, le
 *    commentaire ni le hash de paraphe ;
 *  - la mutation et son entrée de journal partagent la transaction ;
 *  - une mutation refusée n'écrit rien, ni courrier ni trace.
 */
import { Role, StatutCourrier, TypeCourrier } from '@prisma/client';
import type { AuthUser } from '../../../common/decorators';
import { CourrierService } from './courrier.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

/**
 * Fausse transaction PostgreSQL : les écritures de mutation et de journal ne
 * sont conservées qu'en cas de succès. Un journal écrit hors transaction
 * survivrait à l'échec de la mutation — ces tests le détectent.
 */
const METHODES_ECRITURE = ['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

function transaction(base: any, tx: any) {
  tx.$queryRaw = jest.fn().mockResolvedValue([{ id: 'courrier-1' }]);
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

  base.$transaction = jest.fn(async (operation: (c: any) => unknown) => {
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

describe('Journal avant/après du courrier', () => {
  const admin = { id: 'admin-1', role: Role.ADMIN } as AuthUser;
  const scolarite = { id: 'sco-1', role: Role.SCOLARITE } as AuthUser;

  const etape = (ordre: number, roleValideur: string, extra: Record<string, unknown> = {}) => ({
    id: `etape-${ordre}`,
    courrierId: 'courrier-1',
    ordre,
    roleValideur,
    statut: StatutCourrier.EN_CIRCUIT,
    valideurId: null,
    paraphe: null,
    parapheLe: null,
    commentaire: null,
    ...extra,
  });

  const avant = () => ({
    id: 'courrier-1',
    numero: 'COUR-2026-00042',
    type: TypeCourrier.ENTRANT,
    objet: 'Objet confidentiel du courrier',
    expediteur: 'Cabinet externe confidentiel',
    destinataire: null,
    dateReception: new Date('2026-10-01T00:00:00.000Z'),
    dateEnvoi: null,
    fichier: 'data:application/pdf;base64,PIECE-JOINTE-CONFIDENTIELLE',
    typeMime: 'application/pdf',
    tailleKo: 812,
    numeroReference: 'REF-ARCHIVE-INTERNE',
    paraphe: 'hash-paraphe-secret',
    notes: 'note libre confidentielle',
    statut: StatutCourrier.EN_CIRCUIT,
    enregistreParId: 'secretaire-1',
    traiteParId: null,
    circuits: [etape(1, 'Secrétariat'), etape(2, 'Chef département')],
  });

  const instantaneAttendu = (statut: StatutCourrier, circuit: any[]) => ({
    id: 'courrier-1',
    numero: 'COUR-2026-00042',
    type: TypeCourrier.ENTRANT,
    statut,
    dateReception: '2026-10-01T00:00:00.000Z',
    dateEnvoi: null,
    fichierJoint: true,
    parapheFourni: true,
    enregistreParId: 'secretaire-1',
    traiteParId: null,
    circuit,
    departementId: null,
  });

  const etapeProjetee = (ordre: number, roleValideur: string, extra: Record<string, unknown> = {}) => ({
    id: `etape-${ordre}`,
    ordre,
    roleValideur,
    statut: StatutCourrier.EN_CIRCUIT,
    valideurId: null,
    parapheFourni: false,
    parapheLe: null,
    commentaireFourni: false,
    ...extra,
  });

  function preparer() {
    const courant = avant();
    const tx: any = {
      courrier: {
        create: jest.fn().mockResolvedValue(courant),
        update: jest.fn().mockResolvedValue({ ...courant }),
        findFirst: jest.fn().mockResolvedValue({ ...courant }),
        findUnique: jest.fn().mockResolvedValue({ ...courant }),
      },
      circuitCourrier: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      courrier: { findFirst: jest.fn().mockResolvedValue(courant) },
      circuitCourrier: {
        findUnique: jest.fn(async (args: any) => courant.circuits.find((e: any) => e.id === args.where.id) ?? null),
      },
      // Un journal écrit hors transaction serait visible ici.
      auditLog: { create: jest.fn() },
    };
    const ecritures = transaction(prisma, tx);
    return { service: new CourrierService(prisma), prisma, tx, ...ecritures };
  }

  const details = (journal: any[]) => JSON.parse(journal[0].data.details);

  it("journalise l'enregistrement dans la transaction, sans pièce, texte libre ni paraphe", async () => {
    const { service, prisma, journal, mutations } = preparer();

    await service.creer(
      {
        numero: 'COUR-2026-00042',
        type: TypeCourrier.ENTRANT,
        objet: 'Objet confidentiel du courrier',
        fichier: 'data:application/pdf;base64,PIECE-JOINTE-CONFIDENTIELLE',
        notes: 'note libre confidentielle',
      } as any,
      scolarite,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['create']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'sco-1',
      action: 'COURRIER_CREE',
      entite: 'Courrier',
      entiteId: 'courrier-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toBeNull();
    expect(ecrit.apres).toEqual(
      instantaneAttendu(StatutCourrier.EN_CIRCUIT, [
        etapeProjetee(1, 'Secrétariat'),
        etapeProjetee(2, 'Chef département'),
      ]),
    );
    const brut = journal[0].data.details;
    expect(brut).not.toContain('PIECE-JOINTE-CONFIDENTIELLE');
    expect(brut).not.toContain('Objet confidentiel du courrier');
    expect(brut).not.toContain('note libre confidentielle');
    expect(brut).not.toContain('hash-paraphe-secret');
    expect(brut).not.toContain('Cabinet externe confidentiel');
  });

  it('journalise la correction des notes sans changer le statut', async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    const courant = await prisma.courrier.findFirst();
    tx.courrier.update.mockResolvedValue({
      ...courant,
      notes: 'note libre confidentielle modifiée',
    });

    await service.modifier(
      'courrier-1',
      {
        notes: 'note libre confidentielle modifiée',
      } as any,
      admin,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.courrier.update.mock.calls[0][0].where).toEqual({ id: 'courrier-1', statut: StatutCourrier.EN_CIRCUIT });
    expect(mutations).toEqual(['update']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'COURRIER_MODIFIE',
      entite: 'Courrier',
      entiteId: 'courrier-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toEqual(
      instantaneAttendu(StatutCourrier.EN_CIRCUIT, [
        etapeProjetee(1, 'Secrétariat'),
        etapeProjetee(2, 'Chef département'),
      ]),
    );
    expect(ecrit.apres).toEqual(
      instantaneAttendu(StatutCourrier.EN_CIRCUIT, [
        etapeProjetee(1, 'Secrétariat'),
        etapeProjetee(2, 'Chef département'),
      ]),
    );
    expect(ecrit.champsModifies).toEqual(['notes']);
    expect(journal[0].data.details).not.toContain('note libre confidentielle modifiée');
  });

  it('refuse le changement de statut par PUT sans mutation ni trace', async () => {
    const { service, journal, mutations } = preparer();
    await expect(service.modifier('courrier-1', { statut: StatutCourrier.ARCHIVE }, admin)).rejects.toThrow(
      'courrier.status_workflow_required',
    );
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it('refuse la correction de notes sur une archive', async () => {
    const { service, tx, journal, mutations } = preparer();
    tx.courrier.findFirst.mockResolvedValue({ ...avant(), statut: StatutCourrier.ARCHIVE });
    await expect(service.modifier('courrier-1', { notes: 'correction' }, admin)).rejects.toThrow(
      'courrier.archive_readonly',
    );
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it('refuse de parapher avant une étape précédente encore ouverte', async () => {
    const { service, tx, journal, mutations } = preparer();
    await expect(service.parapher('courrier-1', 'etape-2', {}, admin)).rejects.toThrow(
      'courrier.previous_step_required',
    );
    expect(tx.circuitCourrier.updateMany).not.toHaveBeenCalled();
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'écrit aucun journal lorsque la modification échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecEcriture = 'update';

    await expect(service.modifier('courrier-1', { notes: 'note libre' } as any, admin)).rejects.toThrow(
      'mutation refusée',
    );

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("annule la modification si l'écriture du journal échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecJournal = true;

    await expect(service.modifier('courrier-1', { notes: 'note libre' } as any, admin)).rejects.toThrow(
      'journal indisponible',
    );

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it('journalise le paraphe de la dernière étape et la clôture du courrier', async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    const courant = await prisma.courrier.findFirst();
    const parapheLe = new Date('2026-10-02T09:00:00.000Z');
    tx.circuitCourrier.count.mockResolvedValue(0);
    tx.courrier.update.mockResolvedValue({
      ...courant,
      statut: StatutCourrier.TRAITE,
      traiteParId: 'sco-1',
      circuits: [
        etape(1, 'Secrétariat', {
          statut: StatutCourrier.TRAITE,
          valideurId: 'sco-1',
          paraphe: 'hash-paraphe-secret',
          parapheLe,
          commentaire: 'commentaire libre confidentiel',
        }),
        etape(2, 'Chef département'),
      ],
    });

    await service.parapher(
      'courrier-1',
      'etape-1',
      {
        paraphe: 'hash-paraphe-secret',
        commentaire: 'commentaire libre confidentiel',
      } as any,
      scolarite,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    // Étape paraphée puis courrier closure : les deux écritures dans la transaction.
    expect(mutations).toEqual(['updateMany', 'update']);
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'sco-1',
      action: 'COURRIER_PARAPHE',
      entite: 'Courrier',
      entiteId: 'courrier-1',
    });
    const ecrit = details(journal);
    expect(ecrit.etape).toEqual({ id: 'etape-1', ordre: 1, roleValideur: 'Secrétariat' });
    expect(ecrit.parapheFourni).toBe(true);
    expect(ecrit.commentaireFourni).toBe(true);
    expect(ecrit.avant.circuit[0]).toEqual(etapeProjetee(1, 'Secrétariat'));
    expect(ecrit.apres.circuit[0]).toEqual(
      etapeProjetee(1, 'Secrétariat', {
        statut: StatutCourrier.TRAITE,
        valideurId: 'sco-1',
        parapheFourni: true,
        parapheLe: '2026-10-02T09:00:00.000Z',
        commentaireFourni: true,
      }),
    );
    expect(ecrit.apres.statut).toBe(StatutCourrier.TRAITE);
    expect(ecrit.champsModifies).toEqual(['circuit', 'statut', 'traiteParId']);
    const brut = journal[0].data.details;
    expect(brut).not.toContain('hash-paraphe-secret');
    expect(brut).not.toContain('commentaire libre confidentiel');
  });

  it("laisse le courrier en circuit tant qu'il reste une étape", async () => {
    const { service, tx, journal } = preparer();
    const courant = await service.trouver('courrier-1', admin);
    tx.circuitCourrier.count.mockResolvedValue(1);
    tx.courrier.findUnique.mockResolvedValue(courant);

    await service.parapher('courrier-1', 'etape-1', { commentaire: 'commentaire libre' } as any, scolarite);

    const ecrit = details(journal);
    expect(ecrit.apres.statut).toBe(StatutCourrier.EN_CIRCUIT);
    expect(ecrit.apres.circuit[0].commentaireFourni).toBe(false);
    expect(ecrit.champsModifies).toEqual(['circuit']);
  });

  it('journalise la clôture et les étapes forcées dans la transaction', async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    const traite = { ...avant(), statut: StatutCourrier.TRAITE };
    tx.courrier.findUnique.mockResolvedValue(traite);
    tx.courrier.update.mockResolvedValue({
      ...traite,
      statut: StatutCourrier.CLASSE,
      notes: 'note libre confidentielle',
      circuits: [
        etape(1, 'Secrétariat', { statut: StatutCourrier.TRAITE }),
        etape(2, 'Chef département', { statut: StatutCourrier.TRAITE }),
      ],
    });

    await service.cloturer('courrier-1', { notes: 'note libre confidentielle' } as any, admin);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.courrier.update.mock.calls[0][0].where).toEqual({ id: 'courrier-1', statut: StatutCourrier.TRAITE });
    expect(mutations).toEqual(['updateMany', 'update']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'COURRIER_CLOTURE',
      entite: 'Courrier',
      entiteId: 'courrier-1',
    });
    const ecrit = details(journal);
    expect(ecrit.transition).toBe(`${StatutCourrier.TRAITE}→${StatutCourrier.CLASSE}`);
    expect(ecrit.avant.statut).toBe(StatutCourrier.TRAITE);
    expect(ecrit.apres.statut).toBe(StatutCourrier.CLASSE);
    expect(ecrit.avant.circuit.every((e: any) => e.statut === StatutCourrier.EN_CIRCUIT)).toBe(true);
    expect(ecrit.apres.circuit.every((e: any) => e.statut === StatutCourrier.TRAITE)).toBe(true);
    expect(ecrit.notesModifiees).toBe(true);
    expect(ecrit.champsModifies).toEqual(['circuit', 'statut', 'notes']);
    expect(journal[0].data.details).not.toContain('note libre confidentielle');
  });

  it("n'écrit aucun journal lorsque la clôture échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecEcriture = 'update';

    await expect(service.cloturer('courrier-1', {} as any, admin)).rejects.toThrow('mutation refusée');

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it('refuse une transition de clôture devenue invalide avant la transaction', async () => {
    const { service, tx, journal, mutations } = preparer();
    tx.courrier.findUnique.mockResolvedValue({ ...avant(), statut: StatutCourrier.ARCHIVE });

    await expect(service.cloturer('courrier-1', {} as any, admin)).rejects.toThrow(
      'courrier.courrier_courrier_statut_la_cloture_exige_en_circuit_traite_',
    );

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'ouvre aucune transaction ni journal pour un paraphe refusé", async () => {
    const { service, prisma, journal, mutations } = preparer();

    await expect(service.parapher('courrier-1', 'etape-2', {} as any, scolarite)).rejects.toThrow(
      'courrier.etape_de_circuit_introuvable_pour_ce_courrier',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(journal).toEqual([]);
    expect(mutations).toEqual([]);
  });

  it('refuse un second paraphe si un autre utilisateur a signé en premier', async () => {
    const { service, tx, journal, mutations } = preparer();
    tx.circuitCourrier.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.parapher('courrier-1', 'etape-1', { paraphe: 'hash' } as any, scolarite)).rejects.toThrow(
      'courrier.cette_etape_a_deja_ete_traitee',
    );

    expect(tx.circuitCourrier.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'etape-1', courrierId: 'courrier-1', statut: StatutCourrier.EN_CIRCUIT },
      }),
    );
    expect(tx.courrier.update).not.toHaveBeenCalled();
    expect(journal).toEqual([]);
    expect(mutations).toEqual([]);
  });
});
