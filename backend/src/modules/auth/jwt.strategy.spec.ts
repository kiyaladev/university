/**
 * Stratégie JWT — l'état du compte au moment de la requête.
 *
 * La stratégie ne se contente pas de vérifier la signature : elle relit le
 * compte en base à chaque requête. C'est cette relecture qui rend effectives
 * la désactivation d'un compte, la suppression d'un compte, le changement de
 * rôle et le refus des mots de passe publics du seed en production.
 *
 * Ces tests verrouillent ce comportement : un jeton parfaitement signé ne
 * doit jamais donner accès à un compte désactivé, supprimé, ou dont le rôle
 * a changé depuis l'émission.
 */
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtStrategy } from './jwt.strategy';

/** Faux ConfigService : la stratégie lit le secret par injection. */
const configDeTest = {
  get: (cle: string) => (cle === 'JWT_SECRET' ? 'secret-de-test' : undefined),
} as any;

/** Mot de passe public du seed : ne doit jamais authentifier en production. */
const MOT_DE_PASSE_DEMO = 'Passer@2026';

function faireUtilisateur(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'u-1',
    email: 'mamadou.diallo@unipresence.gn',
    password: bcrypt.hashSync('Mot-De-Passe-Privat-2026!', 4),
    nom: 'DIALLO',
    prenom: 'Mamadou',
    role: Role.CONTROLEUR,
    actif: true,
    departementId: null,
    motDePasseModifieLe: null,
    enseignant: null,
    etudiant: null,
    ...surcharge,
  };
}

/** Faux Prisma : une seule lecture du compte, observée par le test. */
function fairePrisma(utilisateur: Record<string, unknown> | null) {
  const findUnique = jest.fn().mockResolvedValue(utilisateur);
  return { prisma: { user: { findUnique } } as any, findUnique };
}

describe('JwtStrategy — relecture du compte à chaque requête', () => {
  it('renvoie l’identité du compte authentifié et ses profils liés', async () => {
    const { prisma } = fairePrisma(
      faireUtilisateur({
        departementId: 'dep-1',
        enseignant: { id: 'ens-1' },
        etudiant: { id: 'etu-1' },
      }),
    );
    const strategie = new JwtStrategy(prisma, configDeTest);

    const utilisateur = await strategie.validate({ sub: 'u-1' });

    expect(utilisateur).toEqual({
      id: 'u-1',
      email: 'mamadou.diallo@unipresence.gn',
      nom: 'DIALLO',
      prenom: 'Mamadou',
      role: Role.CONTROLEUR,
      departementId: 'dep-1',
      enseignantId: 'ens-1',
      etudiantId: 'etu-1',
    });
  });

  it('laisse les identifiants de profil à null quand le compte n’en est lié à aucun', async () => {
    const { prisma } = fairePrisma(faireUtilisateur());
    const strategie = new JwtStrategy(prisma, configDeTest);

    const utilisateur = await strategie.validate({ sub: 'u-1' });

    expect(utilisateur.enseignantId).toBeNull();
    expect(utilisateur.etudiantId).toBeNull();
  });

  it('ne charge que l’identifiant des profils enseignant et étudiant', async () => {
    const { prisma, findUnique } = fairePrisma(faireUtilisateur());
    const strategie = new JwtStrategy(prisma, configDeTest);

    await strategie.validate({ sub: 'u-1' });

    // Une relation chargée en entier trimballerait des coordonnées et des
    // notes dans le chemin d'authentification : on ne prend que l'identifiant.
    expect(findUnique.mock.calls[0][0].include).toEqual({
      enseignant: { select: { id: true } },
      etudiant: { select: { id: true } },
    });
  });

  it('refuse un compte désactivé, même si son jeton est parfaitement signé', async () => {
    const { prisma } = fairePrisma(faireUtilisateur({ actif: false }));
    const strategie = new JwtStrategy(prisma, configDeTest);

    await expect(strategie.validate({ sub: 'u-1' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un compte supprimé entre-temps', async () => {
    const { prisma } = fairePrisma(null);
    const strategie = new JwtStrategy(prisma, configDeTest);

    await expect(strategie.validate({ sub: 'u-1' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('applique le rôle courant du compte, pas celui figé à l’émission du jeton', async () => {
    // L'administrateur a requalifié le compte après l'émission du jeton :
    // l'ancien jeton ne doit pas conserver les anciens pouvoirs.
    const { prisma } = fairePrisma(faireUtilisateur({ role: Role.ETUDIANT }));
    const strategie = new JwtStrategy(prisma, configDeTest);

    const utilisateur = await strategie.validate({ sub: 'u-1' });

    expect(utilisateur.role).toBe(Role.ETUDIANT);
  });

  it('ne rend pas les mots de passe du seed utilizables en production', async () => {
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { prisma } = fairePrisma(faireUtilisateur({ password: bcrypt.hashSync(MOT_DE_PASSE_DEMO, 4) }));
      const strategie = new JwtStrategy(prisma, configDeTest);

      await expect(
        strategie.validate({ sub: 'u-1', iat: Math.floor(Date.now() / 1000) }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
  });

  it('accepte en production un compte muni d’un mot de passe privé', async () => {
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { prisma } = fairePrisma(faireUtilisateur());
      const strategie = new JwtStrategy(prisma, configDeTest);

      await expect(
        strategie.validate({ sub: 'u-1', iat: Math.floor(Date.now() / 1000) }),
      ).resolves.toMatchObject({ id: 'u-1' });
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
  });
});
