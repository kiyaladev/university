import { anneeNumero, prochainNumero, prochainNumeroTx, type Numerotable } from './numero';

/**
 * Delegate Prisma minimal : il honore `where.startsWith` et `select` comme le
 * vrai le fait, sinon le test ne vérifierait pas ce qu'il prétend vérifier.
 */
function delegate(valeurs: string[]): Numerotable & { findMany: jest.Mock } {
  return {
    findMany: jest.fn(async (args: any) => {
      const champ = args.select ? Object.keys(args.select)[0] : 'numero';
      const prefixe = args?.where?.[champ]?.startsWith ?? '';
      return valeurs.filter((valeur) => valeur.startsWith(prefixe)).map((valeur) => ({ [champ]: valeur }));
    }),
  };
}

describe('numérotation séquentielle', () => {
  it('démarre à 1 quand la table est vide', async () => {
    expect(await prochainNumero(delegate([]), 'numero', 'REC-2026-', 5)).toBe('REC-2026-00001');
  });

  it('reprend après le plus grand numéro, pas après le dernier créé', async () => {
    // L'ordre des lignes retournées ne doit pas importer : c'est le maximum
    // numérique qui fait foi, sinon un import de masse réémettrait des
    // numéros déjà pris.
    const d = delegate(['REC-2026-00003', 'REC-2026-00007', 'REC-2026-00005']);
    expect(await prochainNumero(d, 'numero', 'REC-2026-', 5)).toBe('REC-2026-00008');
  });

  it('respecte la largeur demandée', async () => {
    const d = delegate(['TKT-2026-0009']);
    expect(await prochainNumero(d, 'numero', 'TKT-2026-', 4)).toBe('TKT-2026-0010');
  });

  it('ignore les lignes qui ne suivent pas le format', async () => {
    // Numéro saisi à la main ou issu d'une ancienne numérotation : on ne veut
    // pas planter la conversion en nombre, ni repartir de zéro.
    const d = delegate(['REC-2026-00012', 'REC-2026-draft', 'REC-2026-']);
    expect(await prochainNumero(d, 'numero', 'REC-2026-', 5)).toBe('REC-2026-00013');
  });

  it('ne confond pas un préfixe voisin', async () => {
    const d = delegate(['REC-2026-00004', 'REC-2027-00099']);
    expect(await prochainNumero(d, 'numero', 'REC-2026-', 5)).toBe('REC-2026-00005');
  });

  it('filtre sur le préfixe demandé', async () => {
    const d = delegate(['2026-0007']);
    await prochainNumero(d, 'matricule', '2026-', 4);
    expect(d.findMany).toHaveBeenCalledWith({
      where: { matricule: { startsWith: '2026-' } },
      select: { matricule: true },
    });
  });

  it('la variante transactionnelle interroge le bon modèle', async () => {
    const paiement = delegate(['PAY-2026-00002']);
    const tx = { paiement };
    expect(await prochainNumeroTx(tx as any, 'paiement', 'reference', 'PAY-2026-', 5)).toBe('PAY-2026-00003');
    expect(paiement.findMany).toHaveBeenCalled();
  });
});

describe('année portée par les numéros', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-22T10:00:00')));
  afterEach(() => jest.useRealTimers());

  it('prend la fin du libellé scolaire par défaut (matricules, INS-, PAY-, PAY-R-)', () => {
    expect(anneeNumero('2025-2026')).toBe('2026');
    expect(anneeNumero(' 2025 - 2026 ')).toBe('2026');
  });

  it('prend le début du libellé quand le module le demande (attestations)', () => {
    expect(anneeNumero('2025-2026', 'debut')).toBe('2025');
  });

  it("retombe sur l'année civile sans libellé exploitable", () => {
    expect(anneeNumero()).toBe('2026');
    expect(anneeNumero(null)).toBe('2026');
    expect(anneeNumero('')).toBe('2026');
    expect(anneeNumero('Année 2025')).toBe('2026');
    expect(anneeNumero('25-26', 'debut')).toBe('2026');
  });
});
