import { optionsJwt } from './jwt-config.module';

/** Faux ConfigService : ne renvoie que les clés qu'on lui fournit. */
function config(valeurs: Record<string, string>) {
  return { get: <T = string>(cle: string) => valeurs[cle] as T | undefined };
}

describe('options du module JWT', () => {
  it('utilise le secret de la configuration quand il est présent', () => {
    const o = optionsJwt(config({ JWT_SECRET: 'secret-de-test', JWT_EXPIRES_IN: '8h' }));
    expect(o.secret).toBe('secret-de-test');
    expect(o.signOptions.expiresIn).toBe('8h');
  });

  it('ne retombe jamais sur la valeur de repli si la variable est définie', () => {
    // Le bug que ce module ferme : le décorateur @Module est évalué à
    // l'import du fichier, donc avant ConfigModule.forRoot() — `process.env`
    // valait undefined et les jetons étaient signés avec le repli écrit en
    // clair dans le dépôt. Ici la configuration est déjà lue.
    expect(optionsJwt(config({ JWT_SECRET: 'depuis-le-dotenv' })).secret).not.toBe('change-me-in-production');
  });

  it("avertit par la valeur de repli quand aucune configuration n'est fournie", () => {
    // Sans secret, le comportement doit rester celui d'un environnement de
    // développement — le build de production, lui, échoue si la variable manque.
    expect(optionsJwt(config({})).secret).toBe('change-me-in-production');
    expect(optionsJwt(config({})).signOptions.expiresIn).toBe('12h');
  });

  describe('en production', () => {
    const nodeEnv = process.env.NODE_ENV;
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });
    afterEach(() => {
      process.env.NODE_ENV = nodeEnv;
    });

    it('refuse un secret absent', () => {
      expect(() => optionsJwt(config({}))).toThrow(/JWT_SECRET/);
    });

    it('refuse la valeur d’exemple publique de .env.example', () => {
      expect(() => optionsJwt(config({ JWT_SECRET: 'change-me-in-production' }))).toThrow(/JWT_SECRET/);
    });

    it('accepte un secret réel', () => {
      expect(optionsJwt(config({ JWT_SECRET: 'a'.repeat(64) })).secret).toBe('a'.repeat(64));
    });
  });
});
