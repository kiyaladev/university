import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../common/decorators';
import { UTILISATEUR_OPTIONNEL_KEY } from '../../common/utilisateur-optionnel';
import { RestoController } from './resto.controller';

describe('routes du poste de guichet du restaurant', () => {
  it('restent publiques mais résolvent l’utilisateur si un jeton valide est présent', () => {
    for (const methode of ['carte', 'valider']) {
      const handler = (RestoController.prototype as any)[methode];
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
      expect(Reflect.getMetadata(UTILISATEUR_OPTIONNEL_KEY, handler)).toBe(true);
    }
  });
});
