import { intervalleDates, whereEtudiants, whereInscriptions } from './filtres';

const PROMO = '11111111-1111-4111-8111-111111111111';
const DEBUT = new Date('2026-09-01');
const FIN_INCLUSE = new Date(new Date('2026-09-30').getTime() + 86_400_000 - 1);

describe('intervalleDates', () => {
  it('ne filtre rien sans borne', () => {
    expect(intervalleDates()).toBeUndefined();
  });

  it('inclut toute la journée de fin', () => {
    expect(intervalleDates('2026-09-01', '2026-09-30')).toEqual({ gte: DEBUT, lte: FIN_INCLUSE });
    expect(FIN_INCLUSE.toISOString()).toBe('2026-09-30T23:59:59.999Z');
  });

  it('accepte une seule borne', () => {
    expect(intervalleDates('2026-09-01')).toEqual({ gte: DEBUT });
    expect(intervalleDates(undefined, '2026-09-30')).toEqual({ lte: FIN_INCLUSE });
  });
});

describe('whereEtudiants', () => {
  it('reste vide sans filtre', () => {
    expect(whereEtudiants({})).toEqual({});
  });

  it('filtre actif et sexe sur la fiche', () => {
    expect(whereEtudiants({ actif: '0', sexe: 'F' })).toEqual({ actif: false, sexe: 'F' });
    expect(whereEtudiants({ actif: 'true' })).toEqual({ actif: true });
  });

  it('passe la promotion par la relation inscriptions', () => {
    expect(whereEtudiants({ promotionId: PROMO })).toEqual({
      inscriptions: { some: { promotionId: PROMO } },
    });
  });

  it('porte promotion et période sur un même dossier (createdAt)', () => {
    expect(whereEtudiants({ promotionId: PROMO, dateDebut: '2026-09-01', dateFin: '2026-09-30' })).toEqual({
      inscriptions: {
        some: { promotionId: PROMO, createdAt: { gte: DEBUT, lte: FIN_INCLUSE } },
      },
    });
  });
});

describe('whereInscriptions', () => {
  it('reste vide sans filtre', () => {
    expect(whereInscriptions({})).toEqual({});
  });

  it('conserve les filtres existants', () => {
    expect(
      whereInscriptions({
        anneeId: 'a',
        promotionId: PROMO,
        etudiantId: 'e',
        statut: 'PAYEE',
      }),
    ).toEqual({ anneeId: 'a', promotionId: PROMO, etudiantId: 'e', statut: 'PAYEE' });
  });

  it('filtre la date d’inscription, à défaut la date de création', () => {
    expect(whereInscriptions({ dateDebut: '2026-09-01' })).toEqual({
      AND: [
        {
          OR: [{ dateInscription: { gte: DEBUT } }, { dateInscription: null, createdAt: { gte: DEBUT } }],
        },
      ],
    });
  });

  it('combine recherche et période sans écraser les OR', () => {
    const where = whereInscriptions({ search: 'INS', dateFin: '2026-09-30' });
    expect(where.AND).toHaveLength(2);
    const [recherche, periode] = where.AND as any[];
    expect(recherche.OR[0]).toEqual({ numero: { contains: 'INS', mode: 'insensitive' } });
    expect(periode.OR[1]).toEqual({ dateInscription: null, createdAt: { lte: FIN_INCLUSE } });
  });
});
