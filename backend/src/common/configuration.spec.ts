import { bilanConfiguration, validerConfiguration } from './configuration';

const PROD_MINIMALE = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/db',
  JWT_SECRET: 'a'.repeat(64),
};

describe('schéma de configuration', () => {
  it('démarre la production avec les seules variables déjà exigées, en avertissant pour le reste', () => {
    const journal = { warn: jest.fn() };
    expect(validerConfiguration({ ...PROD_MINIMALE }, journal)).toEqual(PROD_MINIMALE);
    const messages = journal.warn.mock.calls.map(([m]) => m).join('\n');
    expect(messages).toMatch(/CORS_ORIGINS/);
    expect(messages).toMatch(/BIOMETRIE_SECRET/);
    expect(messages).toMatch(/BIOMETRIE_CHIFFREMENT_CLE/);
  });

  it('bloque la production sans JWT_SECRET ou avec la valeur d’exemple', () => {
    const journal = { warn: jest.fn() };
    expect(() => validerConfiguration({ ...PROD_MINIMALE, JWT_SECRET: undefined }, journal)).toThrow(/JWT_SECRET/);
    expect(() => validerConfiguration({ ...PROD_MINIMALE, JWT_SECRET: 'change-me-in-production' }, journal)).toThrow(
      /JWT_SECRET/,
    );
  });

  it('bloque toujours sans DATABASE_URL et liste toutes les erreurs ensemble', () => {
    const { erreurs } = bilanConfiguration({ NODE_ENV: 'production' });
    expect(erreurs).toHaveLength(2);
    expect(bilanConfiguration({}).erreurs).toEqual([expect.stringMatching(/DATABASE_URL/)]);
  });

  it('n’avertit que pour les valeurs facultatives mal formées, sans bloquer', () => {
    const { erreurs, avertissements } = bilanConfiguration({
      ...PROD_MINIMALE,
      AUTH_ECHECS_MAX: 'dix',
      URL_APPLICATION: 'university.example',
      MOBILE_MONEY_URL: 'https://mm.example',
      PORT: '5081',
    });
    expect(erreurs).toEqual([]);
    expect(avertissements.join('\n')).toMatch(/AUTH_ECHECS_MAX/);
    expect(avertissements.join('\n')).toMatch(/URL_APPLICATION/);
    expect(avertissements.join('\n')).toMatch(/MOBILE_MONEY_API_KEY/);
    expect(avertissements.join('\n')).not.toMatch(/PORT/);
  });

  it('accepte le secret d’exemple hors production, avec un avertissement', () => {
    const { erreurs, avertissements } = bilanConfiguration({ DATABASE_URL: 'postgresql://x', NODE_ENV: 'development' });
    expect(erreurs).toEqual([]);
    expect(avertissements.join('\n')).toMatch(/JWT_SECRET/);
  });
});
