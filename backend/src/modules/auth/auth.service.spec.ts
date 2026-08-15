/**
 * Durcissement de la connexion : verrouillage après échecs répétés et
 * révocation des jetons émis avant un changement de mot de passe.
 */
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

const MOT_DE_PASSE = 'Passer@2026';

function faireUtilisateur(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'u-1',
    email: 'controleur@unipresence.gn',
    password: bcrypt.hashSync(MOT_DE_PASSE, 4),
    nom: 'DIALLO',
    prenom: 'Mamadou',
    role: Role.CONTROLEUR,
    actif: true,
    departementId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    tentativesEchouees: 0,
    verrouilleJusqua: null,
    motDePasseModifieLe: null,
    enseignant: null,
    departement: null,
    ...surcharge,
  };
}

function fairePrisma(utilisateur: ReturnType<typeof faireUtilisateur> | null) {
  const majs: Record<string, unknown>[] = [];
  const traces: Record<string, unknown>[] = [];
  return {
    majs,
    traces,
    user: {
      findUnique: jest.fn().mockResolvedValue(utilisateur),
      update: jest.fn(({ data }: any) => {
        majs.push(data);
        return Promise.resolve({ ...utilisateur, ...data });
      }),
    },
    auditLog: {
      create: jest.fn(({ data }: any) => {
        traces.push(data);
        return Promise.resolve(data);
      }),
    },
  };
}

const jwt = { signAsync: jest.fn().mockResolvedValue('jeton') } as any;

describe('AuthService — verrouillage après échecs', () => {
  it('compte les tentatives ratées sans verrouiller tout de suite', async () => {
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 2 }));
    const service = new AuthService(prisma as any, jwt);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: 'faux' } as any, '10.0.0.1'),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.majs[0]).toMatchObject({ tentativesEchouees: 3, verrouilleJusqua: null });
    expect(prisma.traces[0]).toMatchObject({ action: 'LOGIN_ECHEC' });
  });

  it('verrouille le compte au seuil et trace l’incident', async () => {
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 9 }));
    const service = new AuthService(prisma as any, jwt);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: 'faux' } as any),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.majs[0].tentativesEchouees).toBe(0);
    expect(prisma.majs[0].verrouilleJusqua).toBeInstanceOf(Date);
    expect(prisma.traces[0]).toMatchObject({ action: 'LOGIN_VERROUILLAGE' });
  });

  it('refuse le bon mot de passe tant que le verrou court', async () => {
    const dans5min = new Date(Date.now() + 5 * 60_000);
    const prisma = fairePrisma(faireUtilisateur({ verrouilleJusqua: dans5min }));
    const service = new AuthService(prisma as any, jwt);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: MOT_DE_PASSE } as any),
    ).rejects.toThrow(/bloqué/);
  });

  it('laisse repasser une fois le verrou expiré et remet le compteur à zéro', async () => {
    const passe = new Date(Date.now() - 60_000);
    const prisma = fairePrisma(faireUtilisateur({ verrouilleJusqua: passe, tentativesEchouees: 0 }));
    const service = new AuthService(prisma as any, jwt);

    const res = await service.login(
      { email: 'controleur@unipresence.gn', password: MOT_DE_PASSE } as any,
    );

    expect(res.token).toBe('jeton');
    expect(prisma.majs[0]).toMatchObject({ tentativesEchouees: 0, verrouilleJusqua: null });
  });

  it('donne le même message que le compte existe ou non', async () => {
    const inconnu = new AuthService(fairePrisma(null) as any, jwt);
    const connu = new AuthService(fairePrisma(faireUtilisateur()) as any, jwt);

    const erreurs = await Promise.all(
      [inconnu, connu].map((s) =>
        s
          .login({ email: 'x@unipresence.gn', password: 'faux' } as any)
          .then(() => null)
          .catch((e) => e.message),
      ),
    );

    expect(erreurs[0]).toBe(erreurs[1]);
  });

  it('horodate le changement de mot de passe pour couper les sessions', async () => {
    const prisma = fairePrisma(faireUtilisateur());
    const service = new AuthService(prisma as any, jwt);

    await service.changePassword({ id: 'u-1' } as any, {
      ancien: MOT_DE_PASSE,
      nouveau: 'Nouveau@2026',
    } as any);

    expect(prisma.majs[0].motDePasseModifieLe).toBeInstanceOf(Date);
  });
});

describe('JwtStrategy — jetons antérieurs au changement de mot de passe', () => {
  const secondes = (d: Date) => Math.floor(d.getTime() / 1000);

  it('rejette un jeton émis avant le changement', async () => {
    const change = new Date('2026-08-14T10:00:00Z');
    const prisma = fairePrisma(faireUtilisateur({ motDePasseModifieLe: change }));
    const strategie = new JwtStrategy(prisma as any);

    await expect(
      strategie.validate({ sub: 'u-1', iat: secondes(new Date('2026-08-14T09:00:00Z')) }),
    ).rejects.toThrow(/Session expirée/);
  });

  it('accepte un jeton émis après le changement', async () => {
    const change = new Date('2026-08-14T10:00:00Z');
    const prisma = fairePrisma(faireUtilisateur({ motDePasseModifieLe: change }));
    const strategie = new JwtStrategy(prisma as any);

    const user = await strategie.validate({
      sub: 'u-1',
      iat: secondes(new Date('2026-08-14T10:00:30Z')),
    });
    expect(user.role).toBe(Role.CONTROLEUR);
  });

  it('accepte un jeton émis dans la même seconde que le changement', async () => {
    const change = new Date('2026-08-14T10:00:00.400Z');
    const prisma = fairePrisma(faireUtilisateur({ motDePasseModifieLe: change }));
    const strategie = new JwtStrategy(prisma as any);

    await expect(
      strategie.validate({ sub: 'u-1', iat: secondes(change) }),
    ).resolves.toBeTruthy();
  });
});
