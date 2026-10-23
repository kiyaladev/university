import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators';
import { DocumentsDemandeController } from './documents-demande.controller';

describe('Accès au registre des demandes de documents', () => {
  const roles = (method: keyof DocumentsDemandeController): Role[] =>
    Reflect.getMetadata(ROLES_KEY, DocumentsDemandeController.prototype[method]);

  it('autorise la direction à lire le registre et le tableau de bord', () => {
    expect(roles('liste')).toEqual([Role.ADMIN, Role.SCOLARITE, Role.DIRECTION]);
    expect(roles('dashboard')).toEqual([Role.ADMIN, Role.SCOLARITE, Role.DIRECTION]);
  });

  it('déclare explicitement les rôles autorisés au détail', () => {
    expect(roles('findOne')).toEqual([Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.ETUDIANT]);
  });

  it('garde les actions de traitement réservées à la scolarité et à l’administration', () => {
    for (const method of ['confirmerPaiement', 'lancerTraitement', 'marquerPrete', 'remettre', 'rejeter'] as const) {
      expect(roles(method)).toEqual([Role.ADMIN, Role.SCOLARITE]);
    }
  });
});
