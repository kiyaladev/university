import { ModePaiement, Role, StatutDemande } from '@prisma/client';
import { DocumentsDemandeService } from './documents-demande.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

const DEMANDE = {
  id: 'dem-1',
  numero: 'DOC-2026-00003',
  type: 'RELEVE_NOTES',
  etudiantId: 'etudiant-1',
  inscriptionId: null,
  frais: 25000,
  devise: 'GNF',
  statut: StatutDemande.EN_ATTENTE_PAIEMENT,
  paiementId: null,
};

/**
 * Delegate Prisma minimal : il honore `startsWith`, les bornes de plage et
 * l'ordre décroissant, sinon le test ne prouverait pas que les deux séries ne
 * se confondent pas.
 */
function paiementsExistants(references: string[]) {
  return jest.fn(async (args: any) => {
    const champ = Object.keys(args.select)[0];
    const filtre = args.where[champ];
    const retenues = references.filter((reference) => {
      if (filtre.startsWith && !reference.startsWith(filtre.startsWith)) return false;
      if (filtre.gte && reference < filtre.gte) return false;
      if (filtre.lte && reference > filtre.lte) return false;
      return true;
    });
    const triees = retenues.slice().sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return triees.slice(0, args.take ?? triees.length).map((reference) => ({ [champ]: reference }));
  });
}

function serviceAvec(references: string[]) {
  const paiementFindMany = paiementsExistants(references);
  const paiementCree = { ...DEMANDE, id: 'pay-1', reference: '' };
  const tx: any = {
    demandeDocument: {
      findUnique: jest.fn().mockResolvedValue(DEMANDE),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    paiement: {
      findMany: paiementFindMany,
      create: jest.fn(async ({ data }: any) => ({ ...paiementCree, ...data })),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = { $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)) };
  const service = new DocumentsDemandeService(prisma as any);
  jest.spyOn(service, 'findOnePour').mockResolvedValue({ ...DEMANDE } as any);
  jest.spyOn(service, 'lire').mockResolvedValue({ ...DEMANDE } as any);
  return { service, tx, paiementFindMany };
}

const ETUDIANT = { id: 'user-1', etudiantId: 'etudiant-1', role: Role.ETUDIANT } as any;

describe('numérotation des paiements de demandes de documents', () => {
  it('prend un préfixe propre aux documents, distinct de celui des paiements de scolarité', async () => {
    const { service, tx } = serviceAvec(['PAY-2026-00001', 'PAY-2026-00002']);

    await service.payer('dem-1', { mode: ModePaiement.ESPECES }, ETUDIANT);

    const reference = tx.paiement.create.mock.calls[0][0].data.reference;
    expect(reference).toMatch(/^PAY-D-\d{4}-\d{5}$/);
    expect(reference).not.toMatch(/^PAY-\d{4}-\d{5}$/);
  });

  it('ne reprend pas le compteur des paiements de scolarité', async () => {
    const { service, tx } = serviceAvec(['PAY-2026-00041', 'PAY-2026-00042']);

    await service.payer('dem-1', { mode: ModePaiement.ESPECES }, ETUDIANT);

    // La série des documents est nouvelle : elle repart de 00001, elle ne
    // continue pas le compteur des paiements de scolarité.
    expect(tx.paiement.create.mock.calls[0][0].data.reference).toBe('PAY-D-2026-00001');
  });

  it('reprend la série des documents après les références déjà émises', async () => {
    const { service, tx } = serviceAvec(['PAY-2026-00041', 'PAY-D-2026-00007']);

    await service.payer('dem-1', { mode: ModePaiement.ESPECES }, ETUDIANT);

    expect(tx.paiement.create.mock.calls[0][0].data.reference).toBe('PAY-D-2026-00008');
  });

  it('interroge la série des documents, jamais celle des paiements de scolarité', async () => {
    const { service, paiementFindMany } = serviceAvec(['PAY-2026-00041', 'PAY-D-2026-00007']);

    await service.payer('dem-1', { mode: ModePaiement.ESPECES }, ETUDIANT);

    const filtres = paiementFindMany.mock.calls.map((call: any[]) => call[0].where.reference);
    expect(filtres.every((filtre: any) => filtre.startsWith === 'PAY-D-2026-')).toBe(true);
  });
});
