import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { jetonImprimable, verifierJetonImprimable } from './jeton-imprimable';

function requete(opts: { entete?: string; token?: string }): Request {
  return {
    headers: opts.entete === undefined ? {} : { authorization: opts.entete },
    query: opts.token === undefined ? {} : { token: opts.token },
  } as unknown as Request;
}

describe('jeton des routes imprimables', () => {
  it("préfère l'en-tête Authorization au paramètre d'URL", () => {
    // Un jeton passé en query string se retrouve dans l'historique et dans
    // les Referer : dès qu'un en-tête est disponible, il doit primer.
    expect(jetonImprimable(requete({ entete: 'Bearer depuis-entete', token: 'depuis-url' }))).toBe('depuis-entete');
  });

  it("accepte l'en-tête seul", () => {
    expect(jetonImprimable(requete({ entete: 'Bearer abc.def.ghi' }))).toBe('abc.def.ghi');
  });

  it('retombe sur le paramètre ?token= pour les liens déjà diffusés', () => {
    expect(jetonImprimable(requete({ token: 'ancien-lien' }))).toBe('ancien-lien');
  });

  it("ignore un en-tête qui n'est pas un Bearer", () => {
    expect(jetonImprimable(requete({ entete: 'Basic dXNlcjpwdw==', token: 'fallback' }))).toBe('fallback');
  });

  it('renvoie undefined pour un visiteur anonyme', () => {
    expect(jetonImprimable(requete({}))).toBeUndefined();
  });

  it('ignore un paramètre token vide ou non textuel', () => {
    expect(jetonImprimable(requete({ token: '' }))).toBeUndefined();
    // Un tableau (?token=a&token=b) n'est pas un jeton exploitable.
    expect(jetonImprimable({ headers: {}, query: { token: ['a', 'b'] } } as unknown as Request)).toBeUndefined();
  });

  it('vérifie le jeton et transmet les options à JWT', () => {
    const jwt = { verify: jest.fn().mockReturnValue({ sub: 'user-1' }) };
    const options = { audience: 'document' };

    expect(verifierJetonImprimable(jwt as any, requete({ token: 'document-token' }), options)).toEqual({
      sub: 'user-1',
    });
    expect(jwt.verify).toHaveBeenCalledWith('document-token', options);
  });

  it('refuse un jeton absent ou invalide avec une réponse 401', () => {
    const jwt = {
      verify: jest.fn().mockImplementation(() => {
        throw new Error('expired');
      }),
    };

    expect(() => verifierJetonImprimable(jwt as any, requete({}))).toThrow(UnauthorizedException);
    expect(jwt.verify).toHaveBeenCalledWith('', undefined);
  });
});
