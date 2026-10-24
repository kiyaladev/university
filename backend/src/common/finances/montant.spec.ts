/**
 * Le passage de `Float` à `numeric(14,2)` a introduit deux pièges que le
 * compilateur ne voit pas, et que ces tests verrouillent :
 *
 *   1. un `Prisma.Decimal` n'est pas un nombre — il sérialise en chaîne ;
 *   2. un `Prisma.Decimal(0)` est un OBJET, donc « vrai » : tout test de
 *      vérité appliqué directement à un montant change de sens (0 devient
 *      « non nul »).
 */
import { Prisma } from '@prisma/client';
import { of } from 'rxjs';
import { estDecimal, montantsEnNombres, toDecimal, toMontant } from './montant';
import { MontantInterceptor } from './montant.interceptor';

describe('toMontant', () => {
  it('convertit un Decimal en nombre', () => {
    expect(toMontant(new Prisma.Decimal('1234.50'))).toBe(1234.5);
    expect(toMontant(new Prisma.Decimal('0'))).toBe(0);
    expect(toMontant(new Prisma.Decimal('-1500.25'))).toBe(-1500.25);
  });

  it('laisse passer un nombre et tolère null/undefined', () => {
    expect(toMontant(1500)).toBe(1500);
    expect(toMontant(null)).toBe(0);
    expect(toMontant(undefined)).toBe(0);
  });

  it('accepte une chaîne (sortie d’un agrégat SQL brut)', () => {
    expect(toMontant('1234.50')).toBe(1234.5);
  });

  it('ne ré-arrondit pas : la colonne a déjà arrondi au centième', () => {
    // Un arrondi supplémentaire en JavaScript déplacerait le montant d’un
    // centime sur les valeurs hautes.
    expect(toMontant(new Prisma.Decimal('1000000000.12'))).toBe(1000000000.12);
  });
});

describe('toDecimal', () => {
  it('produit un Decimal exploitable par Prisma', () => {
    expect(toDecimal(1500).toNumber()).toBe(1500);
    expect(toDecimal(null).toNumber()).toBe(0);
    const existant = new Prisma.Decimal('42.42');
    expect(toDecimal(existant).toNumber()).toBe(42.42);
  });
});

describe('estDecimal', () => {
  it('reconnaît un Decimal et refuse un nombre', () => {
    expect(estDecimal(new Prisma.Decimal('1'))).toBe(true);
    expect(estDecimal(1)).toBe(false);
    expect(estDecimal(null)).toBe(false);
    expect(estDecimal(new Date())).toBe(false);
    expect(estDecimal([new Prisma.Decimal('1')])).toBe(false);
  });
});

describe('montantsEnNombres', () => {
  it('remplace un Decimal racine par son nombre', () => {
    expect(montantsEnNombres(new Prisma.Decimal('42.42'))).toBe(42.42);
  });

  it('descend dans les objets et les tableaux', () => {
    const charge = {
      id: 'paiement-1',
      montant: new Prisma.Decimal('2500.75'),
      lignes: [{ montantBrut: new Prisma.Decimal('1000') }],
    };
    expect(montantsEnNombres(charge)).toEqual({
      id: 'paiement-1',
      montant: 2500.75,
      lignes: [{ montantBrut: 1000 }],
    });
  });

  it('sérialise en nombres, pas en chaînes', () => {
    const json = JSON.stringify(montantsEnNombres({ montant: new Prisma.Decimal('1234.50') }));
    expect(json).toBe('{"montant":1234.5}');
    expect(JSON.stringify({ montant: new Prisma.Decimal('1234.50') })).toBe('{"montant":"1234.5"}');
  });

  it('préserve les dates et les buffers', () => {
    const date = new Date('2026-01-02T00:00:00.000Z');
    const buffer = Buffer.from('x');
    const charge = { date, buffer };
    expect(montantsEnNombres(charge)).toEqual({ date, buffer });
  });

  it('ne recopie pas une charge utile sans montant', () => {
    const charge = { id: 'x', nested: { a: 1 } };
    expect(montantsEnNombres(charge)).toBe(charge);
  });
});

describe('MontantInterceptor', () => {
  it('convertit les montants de la réponse HTTP', async () => {
    const interceptor = new MontantInterceptor();
    const contexte = {} as any;
    const reponse = { montant: new Prisma.Decimal('1500.25') };
    const observable = interceptor.intercept(contexte, { handle: () => of(reponse) } as any);
    const valeur = await new Promise<unknown>((resolve) => observable.subscribe(resolve));
    expect(valeur).toEqual({ montant: 1500.25 });
  });
});

describe('pièges du Decimal — le montant nul reste un objet', () => {
  it('un Decimal(0) est « vrai » : il faut tester la valeur', () => {
    const zero = new Prisma.Decimal(0);
    expect(Boolean(zero)).toBe(true); // le piège
    expect(toMontant(zero)).toBe(0); // la parade
    expect(toMontant(zero) === 0).toBe(true);
  });

  it('un montant nul reste nul après conversion', () => {
    expect(montantsEnNombres({ montant: new Prisma.Decimal(0) })).toEqual({ montant: 0 });
  });
});
