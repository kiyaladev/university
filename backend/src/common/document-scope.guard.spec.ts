import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DocumentScopeGuard } from './document-scope.guard';

describe('Périmètre des documents', () => {
  function preparer(role: Role, fields: any, owner: string | null, record: any = { id: 'doc' }) {
    const reflector: any = { get: () => ({ model: 'carteEtudiante', fields }) };
    const delegate = { findFirst: jest.fn().mockResolvedValue(record) };
    const request = {
      user: { role, etudiantId: owner, enseignantId: owner, departementId: owner },
      params: { id: 'doc' },
    };
    const ctx: any = { getHandler: () => {}, switchToHttp: () => ({ getRequest: () => request }) };
    return { guard: new DocumentScopeGuard(reflector, { carteEtudiante: delegate } as any), ctx, delegate };
  }
  it.each([
    [Role.ETUDIANT, 'etudiantId'],
    [Role.ENSEIGNANT, 'encadrantId'],
    [Role.CHEF_DEPARTEMENT, 'departementId'],
  ])('vérifie le propriétaire %s sans charger le contenu', async (role, field) => {
    const { guard, ctx, delegate } = preparer(role, { [role]: field }, 'owner');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(delegate.findFirst).toHaveBeenCalledWith({ where: { id: 'doc', [field]: 'owner' }, select: { id: true } });
  });
  it.each([null, 'owner'])('refuse le profil manquant ou le document tiers', async (owner) => {
    const { guard, ctx } = preparer(Role.ETUDIANT, { [Role.ETUDIANT]: 'etudiantId' }, owner, null);
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });
  it('applique le département à travers la promotion et sa filière', async () => {
    const { guard, ctx, delegate } = preparer(
      Role.CHEF_DEPARTEMENT,
      { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' },
      'dept',
    );
    await guard.canActivate(ctx);
    expect(delegate.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc', promotion: { filiere: { departementId: 'dept' } } },
      select: { id: true },
    });
  });

  it('traite le champ id comme une égalité propriétaire et refuse un identifiant tiers', async () => {
    const { guard, ctx, delegate } = preparer(Role.ENSEIGNANT, { [Role.ENSEIGNANT]: 'id' }, 'owner');
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    expect(delegate.findFirst).not.toHaveBeenCalled();

    ctx.switchToHttp().getRequest().params.id = 'owner';
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(delegate.findFirst).toHaveBeenCalledWith({
      where: { id: 'owner' },
      select: { id: true },
    });
  });

  it('refuse les rôles admis par erreur sans périmètre explicite', async () => {
    const { guard, ctx, delegate } = preparer(Role.CONTROLEUR, {}, 'owner');
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    expect(delegate.findFirst).not.toHaveBeenCalled();
  });

  it('laisse les rôles centraux passer après le contrôle de rôle de la route', async () => {
    const { guard, ctx, delegate } = preparer(Role.ADMIN, {}, 'owner');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(delegate.findFirst).not.toHaveBeenCalled();
  });

  it('masque une faute dans le nom du modèle au lieu de produire une 500', async () => {
    const reflector: any = { get: () => ({ model: 'modeleInconnu', fields: { [Role.ENSEIGNANT]: 'id' } }) };
    const ctx: any = {
      getHandler: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: Role.ENSEIGNANT, enseignantId: 'owner' },
          params: { id: 'owner' },
        }),
      }),
    };
    await expect(new DocumentScopeGuard(reflector, {} as any).canActivate(ctx)).rejects.toThrow(NotFoundException);
  });
});
