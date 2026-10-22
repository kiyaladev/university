import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AUCUN_DEPARTEMENT, estChefDeDepartement, exigerPerimetre, filtreDepartement } from './perimetre';

const chef = { id: 'u1', role: Role.CHEF_DEPARTEMENT, departementId: 'd1' } as any;
const chefSansDepartement = { id: 'u2', role: Role.CHEF_DEPARTEMENT, departementId: null } as any;
const admin = { id: 'u3', role: Role.ADMIN, departementId: 'd1' } as any;
const controleur = { id: 'u4', role: Role.CONTROLEUR, departementId: 'd1' } as any;

describe('estChefDeDepartement', () => {
  it('ne reconnaît que le rôle CHEF_DEPARTEMENT', () => {
    expect(estChefDeDepartement(chef)).toBe(true);
    expect(estChefDeDepartement(admin)).toBe(false);
    expect(estChefDeDepartement(null)).toBe(false);
    expect(estChefDeDepartement(undefined)).toBe(false);
  });
});

describe('filtreDepartement', () => {
  it("borne au département porté par l'entité", () => {
    expect(filtreDepartement(chef)).toEqual({ departementId: 'd1' });
  });

  it('traverse les relations du chemin', () => {
    expect(filtreDepartement(chef, 'affectation.promotion.filiere')).toEqual({
      affectation: { promotion: { filiere: { departementId: 'd1' } } },
    });
  });

  it('utilise la sentinelle pour un chef sans département', () => {
    expect(AUCUN_DEPARTEMENT).toBe('__aucun__');
    expect(filtreDepartement(chefSansDepartement, 'enseignant')).toEqual({ enseignant: { departementId: '__aucun__' } });
    expect(filtreDepartement(chefSansDepartement, 'promotion.filiere', '__aucun_departement__')).toEqual({
      promotion: { filiere: { departementId: '__aucun_departement__' } },
    });
  });

  it('ne filtre pas les autres rôles', () => {
    expect(filtreDepartement(admin, 'promotion.filiere')).toEqual({});
    expect(filtreDepartement(controleur)).toEqual({});
    expect(filtreDepartement(null)).toEqual({});
  });
});

describe('exigerPerimetre', () => {
  it('laisse passer les autres rôles et le département du chef', () => {
    expect(() => exigerPerimetre(admin, 'd2')).not.toThrow();
    expect(() => exigerPerimetre(chef, 'd1')).not.toThrow();
  });

  it('refuse un autre département ou une fiche sans département', () => {
    expect(() => exigerPerimetre(chef, 'd2')).toThrow(ForbiddenException);
    expect(() => exigerPerimetre(chef, null)).toThrow(ForbiddenException);
    expect(() => exigerPerimetre(chefSansDepartement, null)).toThrow(ForbiddenException);
  });
});
