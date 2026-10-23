import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../common/decorators';
import { UTILISATEUR_OPTIONNEL_KEY } from '../../common/utilisateur-optionnel';
import { BibliothequeController } from './bibliotheque.controller';

describe('vitrine publique de la bibliothèque', () => {
  it('reste publique et résout l’utilisateur si un jeton valide est présent', () => {
    for (const methode of ['liste', 'rechercheFts', 'fichier']) {
      const handler = (BibliothequeController.prototype as any)[methode];
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
      expect(Reflect.getMetadata(UTILISATEUR_OPTIONNEL_KEY, handler)).toBe(true);
    }
  });
});
