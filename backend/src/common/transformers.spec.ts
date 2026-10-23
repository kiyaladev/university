import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { toBool } from './transformers';

describe('conversion des booléens', () => {
  it('traduit les textes attendus, en français comme en anglais', () => {
    expect(toBool('true')).toBe(true);
    expect(toBool('TRUE')).toBe(true);
    expect(toBool('1')).toBe(true);
    expect(toBool('oui')).toBe(true);
    expect(toBool('yes')).toBe(true);
    expect(toBool('false')).toBe(false);
    expect(toBool('FALSE')).toBe(false);
    expect(toBool('0')).toBe(false);
    expect(toBool('non')).toBe(false);
    expect(toBool('no')).toBe(false);
  });

  it('laisse les booléens et les nombres tels quels', () => {
    expect(toBool(true)).toBe(true);
    expect(toBool(false)).toBe(false);
    expect(toBool(1)).toBe(true);
    expect(toBool(0)).toBe(false);
  });

  it('traite une chaîne vide comme une absence de filtre', () => {
    expect(toBool('')).toBeUndefined();
    expect(toBool('   ')).toBeUndefined();
  });

  it("ne déforme pas une valeur qu'il ne sait pas traduire", () => {
    // La validation doit alors la refuser, plutôt que de la lire comme « true ».
    expect(toBool('peut-être')).toBe('peut-être');
  });

  it('renvoie undefined pour une valeur absente', () => {
    expect(toBool(undefined)).toBeUndefined();
    expect(toBool(null)).toBeNull();
  });
});
