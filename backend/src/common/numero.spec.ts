import {
  SERIES_NUMERO,
  anneeNumero,
  avecNumeroUnique,
  estCollisionNumero,
  millesimeSerie,
  prefixeSerie,
  prochainNumero,
  prochainNumeroSerie,
  prochainNumeroTx,
  type Numerotable,
} from './numero';

/**
 * Delegate Prisma minimal : il honore `startsWith`, les bornes de plage,
 * l'ordre décroissant et `take` comme le fait Prisma, sinon le test ne
 * vérifierait pas ce qu'il prétend vérifier.
 */
function delegate(valeurs: string[]): Numerotable & { findMany: jest.Mock } {
  return {
    findMany: jest.fn(async (args: any) => {
      const champ = args.select ? Object.keys(args.select)[0] : 'numero';
      const filtre = args?.where?.[champ] ?? {};
      const retenues = valeurs.filter((valeur) => {
        if (filtre.startsWith && !valeur.startsWith(filtre.startsWith)) return false;
        if (filtre.gte && valeur < filtre.gte) return false;
        if (filtre.lte && valeur > filtre.lte) return false;
        return true;
      });
      // Ordre lexicographique décroissant, comme l'ordre de la colonne.
      const triees = retenues.slice().sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
      const limite = typeof args.take === 'number' ? args.take : triees.length;
      return triees.slice(0, limite).map((valeur) => ({ [champ]: valeur }));
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

  it('lit une seule ligne, la plus grande, au lieu de tout le préfixe', async () => {
    const d = delegate(['REC-2026-00003', 'REC-2026-00007']);
    await prochainNumero(d, 'numero', 'REC-2026-', 5);
    expect(d.findMany).toHaveBeenCalledWith({
      where: { numero: { startsWith: 'REC-2026-', gte: 'REC-2026-00000', lte: 'REC-2026-99999' } },
      orderBy: { numero: 'desc' },
      take: 1,
      select: { numero: true },
    });
  });

  it('reprend après une référence illisible sans repartir de zéro', async () => {
    // Une référence saisie à la main peut se retrouver en tête de série : la
    // lecture est élargie à un lot limité plutôt que de bloquer la série.
    const d = delegate(['REC-2026-00012', 'REC-2026-0A0']);
    expect(await prochainNumero(d, 'numero', 'REC-2026-', 5)).toBe('REC-2026-00013');
  });

  it('la variante transactionnelle interroge le bon modèle', async () => {
    const paiement = delegate(['PAY-2026-00002']);
    const tx = { paiement };
    expect(await prochainNumeroTx(tx as any, 'paiement', 'reference', 'PAY-2026-', 5)).toBe('PAY-2026-00003');
    expect(paiement.findMany).toHaveBeenCalled();
  });

  it('la variante par série prend son préfixe et sa largeur dans la table', async () => {
    const paiement = delegate([]);
    const tx = { paiement };
    expect(await prochainNumeroSerie(tx as any, SERIES_NUMERO.PAIEMENT_DOCUMENT_DEMANDE, '2026')).toBe(
      'PAY-D-2026-00001',
    );
  });
});

describe('coexistence des préfixes de paiement', () => {
  it('ne confond pas les paiements de scolarité et ceux des demandes de documents', async () => {
    // Les deux séries vivent dans la même colonne `Paiement.reference`, qui est
    // unique : sans préfixe distinct, une même année produirait deux fois le
    // même numéro.
    const d = delegate(['PAY-2026-00041', 'PAY-D-2026-00007']);
    expect(await prochainNumero(d, 'reference', 'PAY-2026-', 5)).toBe('PAY-2026-00042');
    expect(await prochainNumero(d, 'reference', 'PAY-D-2026-', 5)).toBe('PAY-D-2026-00008');
  });

  it('ne confond pas les paiements de scolarité et ceux des autres portefeuilles', async () => {
    const d = delegate(['PAY-2026-00041', 'PAY-R-2026-00003', 'PAY-F-2026-00009', 'PAY-X-2026-00002']);
    expect(await prochainNumero(d, 'reference', 'PAY-2026-', 5)).toBe('PAY-2026-00042');
    expect(await prochainNumero(d, 'reference', 'PAY-R-2026-', 5)).toBe('PAY-R-2026-00004');
    expect(await prochainNumero(d, 'reference', 'PAY-F-2026-', 5)).toBe('PAY-F-2026-00010');
    expect(await prochainNumero(d, 'reference', 'PAY-X-2026-', 5)).toBe('PAY-X-2026-00003');
  });
});

describe('séries numérotées', () => {
  it('donne un préfixe distinct à chaque module qui crée un paiement', () => {
    const paiements = [
      SERIES_NUMERO.PAIEMENT_INSCRIPTION,
      SERIES_NUMERO.PAIEMENT_DOCUMENT_DEMANDE,
      SERIES_NUMERO.PAIEMENT_FORMATION,
      SERIES_NUMERO.PAIEMENT_RESTAURATION,
      SERIES_NUMERO.PAIEMENT_RECETTE,
    ];
    const prefixes = paiements.map((serie) => serie.prefixe);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    expect(prefixes).toEqual(['PAY-', 'PAY-D-', 'PAY-F-', 'PAY-R-', 'PAY-X-']);
  });

  it('n’emboîte jamais deux séries : un préfixe complet n’en englobe aucun autre', () => {
    const complets = Object.values(SERIES_NUMERO).map((serie) => prefixeSerie(serie, '2026'));
    for (const complet of complets) {
      for (const autre of complets) {
        if (complet === autre) continue;
        expect(autre.startsWith(complet)).toBe(false);
      }
    }
  });

  it('reprend la série de l’année à 00001 quand l’année change', async () => {
    const d = delegate(['PAY-D-2026-00042']);
    expect(await prochainNumero(d, 'reference', 'PAY-D-2026-', 5)).toBe('PAY-D-2026-00043');
    expect(await prochainNumero(d, 'reference', 'PAY-D-2027-', 5)).toBe('PAY-D-2027-00001');
  });

  it('repart de 00001 sur un nouveau préfixe, sans toucher à la série existante', async () => {
    const d = delegate(['PAY-2026-00042']);
    expect(await prochainNumero(d, 'reference', 'PAY-D-2026-', 5)).toBe('PAY-D-2026-00001');
    expect(await prochainNumero(d, 'reference', 'PAY-2026-', 5)).toBe('PAY-2026-00043');
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

  it('applique le millésime déclaré par la série', () => {
    expect(millesimeSerie(SERIES_NUMERO.MATRICULE, '2025-2026')).toBe('2026');
    expect(millesimeSerie(SERIES_NUMERO.INSCRIPTION, '2025-2026')).toBe('2026');
    expect(millesimeSerie(SERIES_NUMERO.PAIEMENT_INSCRIPTION, '2025-2026')).toBe('2026');
    expect(millesimeSerie(SERIES_NUMERO.PAIEMENT_RESTAURATION, '2025-2026')).toBe('2026');
    expect(millesimeSerie(SERIES_NUMERO.ATTESTATION, '2025-2026')).toBe('2025');
  });

  it('donne l’année civile aux séries sans rattachement à une année universitaire', () => {
    expect(millesimeSerie(SERIES_NUMERO.DOCUMENT_DEMANDE)).toBe('2026');
    expect(millesimeSerie(SERIES_NUMERO.PAIEMENT_DOCUMENT_DEMANDE)).toBe('2026');
    expect(millesimeSerie(SERIES_NUMERO.FORMATION)).toBe('2026');
    expect(millesimeSerie(SERIES_NUMERO.PAIEMENT_FORMATION)).toBe('2026');
    expect(millesimeSerie(SERIES_NUMERO.TICKET_SUPPORT)).toBe('2026');
    expect(millesimeSerie(SERIES_NUMERO.RECLAMATION)).toBe('2026');
    expect(millesimeSerie(SERIES_NUMERO.BADGE_ACCES)).toBe('2026');
  });
});

/** Collision d'unicité Prisma, comme la lève le client sur un doublon. */
function violationUnique(colonne?: string): Error {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    ...(colonne ? { meta: { target: [colonne] } } : {}),
  });
}

describe('avecNumeroUnique — relance sur collision de numéro', () => {
  it('crée du premier coup quand rien ne se heurte', async () => {
    const creer = jest.fn().mockResolvedValue({ id: 'ligne-1' });

    await expect(avecNumeroUnique(creer)).resolves.toEqual({ id: 'ligne-1' });
    expect(creer).toHaveBeenCalledTimes(1);
  });

  it('relance sur une collision de numéro et renvoie la tentative qui aboutit', async () => {
    const creer = jest
      .fn()
      .mockRejectedValueOnce(violationUnique('numero'))
      .mockRejectedValueOnce(violationUnique('numero'))
      .mockResolvedValue({ id: 'ligne-3' });

    await expect(avecNumeroUnique(creer, { colonnes: ['numero'] })).resolves.toEqual({ id: 'ligne-3' });
    expect(creer).toHaveBeenCalledTimes(3);
  });

  it('relance trois fois par défaut, puis échoue', async () => {
    const creer = jest.fn().mockRejectedValue(violationUnique('numero'));

    await expect(avecNumeroUnique(creer, { colonnes: ['numero'] })).rejects.toBeDefined();
    expect(creer).toHaveBeenCalledTimes(3);
  });

  it('respecte le nombre de tentatives demandé', async () => {
    const creer = jest.fn().mockRejectedValue(violationUnique('reference'));

    await expect(avecNumeroUnique(creer, { tentatives: 10, colonnes: ['reference'] })).rejects.toBeDefined();
    expect(creer).toHaveBeenCalledTimes(10);
  });

  it('relance sur une contrainte dont le nom n’est pas connu', async () => {
    const creer = jest.fn().mockRejectedValueOnce(violationUnique()).mockResolvedValue({ id: 'ligne-2' });

    await expect(avecNumeroUnique(creer, { colonnes: ['numero'] })).resolves.toEqual({ id: 'ligne-2' });
    expect(creer).toHaveBeenCalledTimes(2);
  });

  it('ne relance pas une collision sur une autre colonne', async () => {
    // Un e-mail déjà pris n'est pas une course sur le compteur : le vrai
    // doublon doit remonter, pas être transformé en « numéro indisponible ».
    const creer = jest.fn().mockRejectedValue(violationUnique('email'));

    await expect(avecNumeroUnique(creer, { colonnes: ['numero'] })).rejects.toBeDefined();
    expect(creer).toHaveBeenCalledTimes(1);
  });

  it('ne relance pas une erreur qui n’est pas une collision', async () => {
    const erreur = new Error('base injoignable');
    const creer = jest.fn().mockRejectedValue(erreur);

    await expect(avecNumeroUnique(creer, { colonnes: ['numero'] })).rejects.toBe(erreur);
    expect(creer).toHaveBeenCalledTimes(1);
  });

  it('lève l’erreur fournie quand toutes les tentatives échouent', async () => {
    const creer = jest.fn().mockRejectedValue(violationUnique('numero'));
    const erreur = new Error('numéro indisponible');

    await expect(avecNumeroUnique(creer, { colonnes: ['numero'], erreur: () => erreur })).rejects.toBe(erreur);
  });

  it('reconnaît une collision de numéro', () => {
    expect(estCollisionNumero(violationUnique('numero'), ['numero'])).toBe(true);
    expect(estCollisionNumero(violationUnique('reference'), ['numero'])).toBe(false);
    expect(estCollisionNumero(new Error('oups'), ['numero'])).toBe(false);
    expect(estCollisionNumero(undefined, ['numero'])).toBe(false);
  });
});
