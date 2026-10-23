import { describe, expect, it } from 'vitest';

import { completerMessageErreur, extraireMessageErreur } from '../../src/shared/utils/erreur-http';

describe('shared/utils/erreur-http', () => {
  describe('extraireMessageErreur', () => {
    it('lit le format unique de l’API', () => {
      const corps = { statusCode: 400, message: 'Saisie invalide', error: 'Bad Request' };

      expect(extraireMessageErreur(corps)).toBe('Saisie invalide');
    });

    it('lit un tableau de messages (plusieurs fautes)', () => {
      const corps = { statusCode: 400, message: ['Champ A requis', 'Champ B invalide'], error: 'Bad Request' };

      expect(extraireMessageErreur(corps)).toEqual(['Champ A requis', 'Champ B invalide']);
    });

    it('lit l’ancien format de validation', () => {
      const corps = { statutCode: 400, erreur: 'ValidationFailed', messages: ['Champ A requis'] };

      expect(extraireMessageErreur(corps)).toEqual(['Champ A requis']);
    });

    it('lit l’ancien code d’erreur seul', () => {
      expect(extraireMessageErreur({ erreur: 'ValidationFailed' })).toBe('ValidationFailed');
    });

    it('ignore un corps sans message', () => {
      expect(extraireMessageErreur({ statusCode: 500, error: 'Internal Server Error' })).toBeUndefined();
      expect(extraireMessageErreur(undefined)).toBeUndefined();
      expect(extraireMessageErreur('texte brut')).toBeUndefined();
    });

    it('ignore un message vide', () => {
      expect(extraireMessageErreur({ statusCode: 503, message: '   ' })).toBeUndefined();
      expect(extraireMessageErreur({ statusCode: 503, message: [] })).toBeUndefined();
    });
  });

  describe('completerMessageErreur', () => {
    it('ajoute le message de l’ancien format sans effacer les autres champs', () => {
      const corps = completerMessageErreur({
        statutCode: 400,
        erreur: 'ValidationFailed',
        messages: ['Champ A requis'],
      });

      expect(corps).toEqual({
        statutCode: 400,
        erreur: 'ValidationFailed',
        messages: ['Champ A requis'],
        message: ['Champ A requis'],
      });
    });

    it('laisse intact un corps déjà au format unique', () => {
      const corps = { statusCode: 400, message: 'Saisie invalide', error: 'Bad Request' };

      expect(completerMessageErreur(corps)).toBe(corps);
    });

    it('ne touche pas à un corps sans message exploitable', () => {
      const corps = { statusCode: 500, error: 'Internal Server Error' };

      expect(completerMessageErreur(corps)).toBe(corps);
    });

    it('ignore un corps qui n’est pas un objet', () => {
      expect(completerMessageErreur('texte brut')).toBeUndefined();
      expect(completerMessageErreur(undefined)).toBeUndefined();
    });
  });
});
