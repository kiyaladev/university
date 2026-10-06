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

type Carnet = { majs: Record<string, unknown>[]; traces: Record<string, unknown>[] };
type Ligne = Record<string, any>;

/**
 * Faux Prisma : les écritures passent par `$transaction` comme en production.
 *
 * - `stockee` est la ligne réellement en base, partagée par toutes les
 *   transactions. Un `{ increment }` s'y applique sur la valeur courante,
 *   comme le fait la base : deux échecs qui se croisent s'additionnent au
 *   lieu de s'écraser, et c'est ce qui rend le test de concurrence discriminant.
 * - `lecture` est l'état qu'une requête lit au début du test : elle ne voit
 *   pas ce que les autres écrivent. C'est exactement la lecture périmée qui
 *   faisait perdre des incréments.
 * - Le carnet validé (`majs`/`traces`) ne reçoit les écritures qu'après succès
 *   de la transaction ; une exception les écarte **et** restaure la ligne :
 *   un rollback réellement observé, pas supposé.
 */
function fairePrisma(
  utilisateur: ReturnType<typeof faireUtilisateur> | null,
  options: { echecEcriture?: 'maj' | 'audit'; etatInitial?: Record<string, unknown> } = {},
) {
  const validees: Carnet = { majs: [], traces: [] };
  const lecture: Ligne | null = utilisateur ? { ...utilisateur } : null;
  let stockee: Ligne | null = utilisateur ? { ...utilisateur, ...options.etatInitial } : null;

  const client = (carnet: Carnet, inverses: (() => void)[]) => ({
    user: {
      findUnique: jest.fn().mockResolvedValue(lecture),
      update: jest.fn(async ({ data, select }: any) => {
        if (options.echecEcriture === 'maj') throw new Error('compteur indisponible');
        carnet.majs.push(data);
        for (const [champ, valeur] of Object.entries(data as Ligne)) {
          const avant = stockee?.[champ] ?? null;
          inverses.push(() => {
            if (stockee) stockee[champ] = avant;
          });
          if (!stockee) continue;
          // `{ increment }` / `{ decrement }` : opérations atomiques appliquées
          // à la valeur courante, à la manière de la base. Une `Date` est
          // affectée telle quelle.
          const operation =
            valeur !== null && typeof valeur === 'object' && !(valeur instanceof Date)
              ? valeur
              : null;
          stockee[champ] =
            operation && ('increment' in operation || 'decrement' in operation)
              ? Number(avant ?? 0) +
                Number(operation.increment ?? 0) -
                Number(operation.decrement ?? 0)
              : valeur;
        }
        if (!select) return { ...stockee };
        return Object.fromEntries(
          Object.keys(select)
            .filter((champ) => select[champ])
            .map((champ) => [champ, stockee?.[champ]]),
        );
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (!stockee || Object.entries(where).some(([champ, valeur]) => stockee?.[champ] !== valeur)) {
          return { count: 0 };
        }
        await client(carnet, inverses).user.update({ data });
        return { count: 1 };
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        if (options.echecEcriture === 'audit') throw new Error('journal indisponible');
        carnet.traces.push(data);
        return data;
      }),
    },
  });

  const horsTransaction = client(validees, []);

  return {
    ...horsTransaction,
    majs: validees.majs,
    traces: validees.traces,
    /** La ligne telle qu'elle est en base à cet instant. */
    ligne: () => (stockee ? { ...stockee } : null),
    $transaction: jest.fn(async (operation: (tx: any) => unknown) => {
      const enAttente: Carnet = { majs: [], traces: [] };
      const inverses: (() => void)[] = [];
      try {
        const resultat = await operation(client(enAttente, inverses));
        // Validation : la transaction aboutit, ses écritures restent en base.
        validees.majs.push(...enAttente.majs);
        validees.traces.push(...enAttente.traces);
        return resultat;
      } catch (e) {
        // Annulation : la ligne retrouve sa valeur d'avant la transaction,
        // incrément compris.
        for (const inverse of inverses.reverse()) inverse();
        throw e;
      }
    }),
  };
}

const jwt = { signAsync: jest.fn().mockResolvedValue('jeton') } as any;

describe('AuthService — verrouillage après échecs', () => {
  it('retourne un profil de connexion minimal sans secrets ni état de verrouillage', async () => {
    const prisma = fairePrisma(faireUtilisateur({
      telephone: '+224620000000',
      departementId: 'dep-1',
      departement: { id: 'dep-1', code: 'INFO', nom: 'Informatique', budget: 5000 },
      enseignant: { id: 'ens-1', matricule: 'ENS-001', empreinteTemplate: 'secret' },
      tentativesEchouees: 4,
      verrouilleJusqua: null,
      motDePasseModifieLe: new Date('2026-01-01T00:00:00Z'),
    }));
    const service = new AuthService(prisma as any, jwt);

    const resultat = await service.login({
      email: 'controleur@unipresence.gn',
      password: MOT_DE_PASSE,
    } as any);

    expect(resultat.user).toEqual({
      id: 'u-1',
      email: 'controleur@unipresence.gn',
      nom: 'DIALLO',
      prenom: 'Mamadou',
      telephone: '+224620000000',
      role: Role.CONTROLEUR,
      actif: true,
      departementId: 'dep-1',
      departement: { id: 'dep-1', code: 'INFO', nom: 'Informatique' },
      enseignantId: 'ens-1',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'controleur@unipresence.gn' },
      select: {
        id: true,
        email: true,
        password: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        tentativesEchouees: true,
        verrouilleJusqua: true,
        motDePasseModifieLe: true,
        departementId: true,
        departement: { select: { id: true, code: true, nom: true } },
        enseignant: { select: { id: true } },
      },
    });
    expect(JSON.stringify(resultat.user)).not.toMatch(/password|empreinte|tentatives|verrouille/i);
  });

  it('retourne le profil avec une projection limitée aux champs utiles', async () => {
    const profil = faireUtilisateur({
      enseignant: { id: 'ens-1', matricule: 'ENS-001', empreinteTemplate: 'secret' },
      departement: { id: 'dep-1', code: 'INFO', nom: 'Informatique', budget: 5000 },
    });
    const prisma = fairePrisma(profil);
    const service = new AuthService(prisma as any, jwt);

    await expect(service.profil({ id: 'u-1' } as any)).resolves.toMatchObject({
      id: 'u-1',
      email: 'controleur@unipresence.gn',
      enseignantId: 'ens-1',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        departementId: true,
        departement: { select: { id: true, code: true, nom: true } },
        enseignant: { select: { id: true } },
      },
    });
  });

  it('compte les tentatives ratées sans verrouiller tout de suite', async () => {
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 2 }));
    const service = new AuthService(prisma as any, jwt);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: 'faux' } as any, '10.0.0.1'),
    ).rejects.toThrow(UnauthorizedException);

    // L'échec est compté par la base, pas recalculé ici depuis la lecture.
    expect(prisma.majs[0]).toEqual({ tentativesEchouees: { increment: 1 } });
    expect(prisma.ligne()).toMatchObject({ tentativesEchouees: 3, verrouilleJusqua: null });
    expect(prisma.traces[0]).toMatchObject({
      action: 'LOGIN_ECHEC',
      ip: '10.0.0.1',
      details: 'Tentative échouée 3/10',
    });
  });

  it('verrouille le compte au seuil et trace l’incident', async () => {
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 9 }));
    const service = new AuthService(prisma as any, jwt);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: 'faux' } as any),
    ).rejects.toThrow(UnauthorizedException);

    // L'incrément franchit le seuil, puis le verrou est posé : compteur
    // remis à zéro, compte bloqué pour la durée configurée (15 min).
    expect(prisma.majs[0]).toEqual({ tentativesEchouees: { increment: 1 } });
    expect(prisma.majs[1]).toMatchObject({ tentativesEchouees: 0 });
    expect(prisma.ligne()!.tentativesEchouees).toBe(0);
    const reste = prisma.ligne()!.verrouilleJusqua as Date;
    expect(reste).toBeInstanceOf(Date);
    expect(reste.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(reste.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    expect(prisma.traces[0]).toMatchObject({
      action: 'LOGIN_VERROUILLAGE',
      details: 'Compte verrouillé 15 min après 10 échecs',
    });
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
    expect(prisma.traces).toHaveLength(1);
    expect(prisma.traces[0]).toMatchObject({ action: 'MOT_DE_PASSE_MODIFIE', userId: 'u-1' });
    expect(prisma.traces[0].details).toBe(JSON.stringify({ sessionsRevoquees: true }));
    expect(prisma.traces[0].details).not.toContain(MOT_DE_PASSE);
  });

  it('annule la modification du mot de passe si sa trace échoue', async () => {
    const prisma = fairePrisma(faireUtilisateur(), { echecEcriture: 'audit' });
    const service = new AuthService(prisma as any, jwt);

    await expect(service.changePassword({ id: 'u-1' } as any, {
      ancien: MOT_DE_PASSE, nouveau: 'Nouveau@2026',
    } as any)).rejects.toThrow('journal indisponible');

    expect(prisma.majs).toEqual([]);
    expect(prisma.traces).toEqual([]);
  });
});

/**
 * Le compteur de tentatives et sa trace d'audit décrivent le même événement :
 * les écrire séparément laisserait un verrou sans trace, ou un compteur gelé
 * après une connexion réussie. Chaque couple est donc validé ensemble.
 */
describe('AuthService — atomicité compteur / journal', () => {
  it('incrémente et trace l’échec dans une seule transaction', async () => {
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 1 }));
    const service = new AuthService(prisma as any, jwt);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: 'faux' } as any),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.majs).toHaveLength(1);
    expect(prisma.traces).toHaveLength(1);
  });

  it('annule le verrouillage si la trace de l’échec ne peut pas être écrite', async () => {
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 9 }), {
      echecEcriture: 'audit',
    });
    const service = new AuthService(prisma as any, jwt);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: 'faux' } as any),
    ).rejects.toThrow(/journal indisponible/);

    // Ni verrou sans trace, ni trace sans écriture : rien n'a été validé,
    // pas même l'incrément appliqué avant l'échec de l'écriture.
    expect(prisma.majs).toEqual([]);
    expect(prisma.traces).toEqual([]);
    expect(prisma.ligne()).toMatchObject({ tentativesEchouees: 9, verrouilleJusqua: null });
  });

  it('annule l’incrément si le compteur ne peut pas être écrit', async () => {
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 1 }), {
      echecEcriture: 'maj',
    });
    const service = new AuthService(prisma as any, jwt);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: 'faux' } as any),
    ).rejects.toThrow(/compteur indisponible/);

    expect(prisma.majs).toEqual([]);
    expect(prisma.traces).toEqual([]);
    expect(prisma.ligne()!.tentativesEchouees).toBe(1);
  });

  it('remet le compteur à zéro et trace LOGIN dans une seule transaction', async () => {
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 3 }));
    const service = new AuthService(prisma as any, jwt);

    await service.login({ email: 'controleur@unipresence.gn', password: MOT_DE_PASSE } as any);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.majs[0]).toMatchObject({ tentativesEchouees: 0, verrouilleJusqua: null });
    expect(prisma.traces[0]).toMatchObject({
      userId: 'u-1',
      action: 'LOGIN',
      entite: 'User',
      entiteId: 'u-1',
    });
  });

  it('trace LOGIN sans écriture quand le compteur était déjà à zéro', async () => {
    const prisma = fairePrisma(faireUtilisateur());
    const service = new AuthService(prisma as any, jwt);

    await service.login({ email: 'controleur@unipresence.gn', password: MOT_DE_PASSE } as any);

    expect(prisma.majs).toEqual([]);
    expect(prisma.traces).toHaveLength(1);
    expect(prisma.traces[0]).toMatchObject({ action: 'LOGIN' });
  });

  it('ne valide ni la remise à zéro ni la trace LOGIN si l’écriture du journal échoue', async () => {
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 3 }), {
      echecEcriture: 'audit',
    });
    const jeton = { signAsync: jest.fn().mockResolvedValue('jeton') } as any;
    const service = new AuthService(prisma as any, jeton);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: MOT_DE_PASSE } as any),
    ).rejects.toThrow(/journal indisponible/);

    // Le compteur n'est pas remis à zéro « dans le vide » : la transaction
    // entière a été annulée, et aucun jeton n'a été délivré.
    expect(prisma.majs).toEqual([]);
    expect(prisma.traces).toEqual([]);
    expect(jeton.signAsync).not.toHaveBeenCalled();
  });
});

/**
 * Le compteur n'est utile que s'il compte *tous* les échecs. Un `echecs + 1`
 * calculé depuis une lecture antérieure fait perdre les incréments qui se
 * croisent : le compte stagne, et le verrouillage est repoussé d'autant. Ces
 * tests font partir plusieurs échecs de la *même* valeur lue, ce qui est la
 * situation que le faux Prisma reproduit (`lecture` figée, ligne `stockee`
 * partagée).
 */
describe('AuthService — échecs concurrents', () => {
  const echecsSimultanes = async (prisma: ReturnType<typeof fairePrisma>, nombre = 2) => {
    const service = new AuthService(prisma as any, jwt);
    const erreurs = await Promise.all(
      Array.from({ length: nombre }, () =>
        service
          .login({ email: 'controleur@unipresence.gn', password: 'faux' } as any)
          .then(() => null)
          .catch((e) => e.message),
      ),
    );
    // Chaque tentative échouée reste un échec, message inchangé.
    expect(erreurs.every((e) => e === 'Identifiants incorrects')).toBe(true);
  };

  it('ne perd aucun incrément quand deux échecs lisent la même valeur', async () => {
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 2 }));

    await echecsSimultanes(prisma);

    // 2 + 2 et non 3 : c'est l'incrément en base qui compte, pas la lecture.
    expect(prisma.ligne()!.tentativesEchouees).toBe(4);
    expect(prisma.majs).toEqual([
      { tentativesEchouees: { increment: 1 } },
      { tentativesEchouees: { increment: 1 } },
    ]);
    // Chaque total est celui réellement atteint, donc numéroté sans trou.
    expect(prisma.traces.map((t) => t.details).sort()).toEqual([
      'Tentative échouée 3/10',
      'Tentative échouée 4/10',
    ]);
  });

  it('décide le verrou sur le total réellement écrit, pas sur la valeur lue', async () => {
    // La requête lit 0 — donc « loin du seuil » — mais le compteur stocké en
    // est déjà à 9 : seul l'incrément réellement appliqué peut révéler que le
    // seuil est franchi.
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 0 }), {
      etatInitial: { tentativesEchouees: 9 },
    });
    const service = new AuthService(prisma as any, jwt);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: 'faux' } as any),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.ligne()!.tentativesEchouees).toBe(0);
    expect(prisma.ligne()!.verrouilleJusqua).toBeInstanceOf(Date);
    expect(prisma.traces[0]).toMatchObject({ action: 'LOGIN_VERROUILLAGE' });
  });

  it('ne laisse pas un échec déjà en vol repousser le verrouillage', async () => {
    // 8 + 2 échecs simultanés atteignent le seuil 10 : le compte se verrouille
    // au lieu d'attendre une troisième tentative.
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 8 }));

    await echecsSimultanes(prisma);

    expect(prisma.ligne()).toMatchObject({ tentativesEchouees: 0 });
    expect(prisma.ligne()!.verrouilleJusqua).toBeInstanceOf(Date);
    expect(prisma.traces.filter((t) => t.action === 'LOGIN_VERROUILLAGE')).toHaveLength(1);
    expect(prisma.traces.filter((t) => t.action === 'LOGIN_ECHEC')).toHaveLength(1);
  });

  it('n’efface pas un verrou posé entre-temps par une autre requête', async () => {
    // L'échec est parti avant le verrouillage : il incremente le compteur mais
    // ne doit surtout pas remettre `verrouilleJusqua` à null, ce qui
    // rouvrirait un compte bloqué.
    const verrouilleParAutre = new Date(Date.now() + 12 * 60_000);
    const prisma = fairePrisma(faireUtilisateur({ tentativesEchouees: 3 }), {
      etatInitial: { verrouilleJusqua: verrouilleParAutre },
    });
    const service = new AuthService(prisma as any, jwt);

    await expect(
      service.login({ email: 'controleur@unipresence.gn', password: 'faux' } as any),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.ligne()!.verrouilleJusqua).toEqual(verrouilleParAutre);
    // L'écriture ne porte que sur le compteur : le champ du verrou n'est
    // mentionné par aucune des requêtes de cet échec.
    expect(prisma.majs).toEqual([{ tentativesEchouees: { increment: 1 } }]);
    expect(prisma.traces[0]).toMatchObject({ action: 'LOGIN_ECHEC' });
  });
});

/** Faux ConfigService : la stratégie lit désormais le secret par injection. */
const configDeTest = {
  get: (cle: string) => (cle === 'JWT_SECRET' ? 'secret-de-test' : undefined),
} as any;

describe('JwtStrategy — jetons antérieurs au changement de mot de passe', () => {
  const secondes = (d: Date) => Math.floor(d.getTime() / 1000);

  it('rejette un jeton émis avant le changement', async () => {
    const change = new Date('2026-08-14T10:00:00Z');
    const prisma = fairePrisma(faireUtilisateur({ motDePasseModifieLe: change }));
    const strategie = new JwtStrategy(prisma as any, configDeTest);

    await expect(
      strategie.validate({ sub: 'u-1', iat: secondes(new Date('2026-08-14T09:00:00Z')) }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepte un jeton émis après le changement', async () => {
    const change = new Date('2026-08-14T10:00:00Z');
    const prisma = fairePrisma(faireUtilisateur({ motDePasseModifieLe: change }));
    const strategie = new JwtStrategy(prisma as any, configDeTest);

    const user = await strategie.validate({
      sub: 'u-1',
      iat: secondes(new Date('2026-08-14T10:00:30Z')),
    });
    expect(user.role).toBe(Role.CONTROLEUR);
  });

  it('accepte un jeton émis dans la même seconde que le changement', async () => {
    const change = new Date('2026-08-14T10:00:00.400Z');
    const prisma = fairePrisma(faireUtilisateur({ motDePasseModifieLe: change }));
    const strategie = new JwtStrategy(prisma as any, configDeTest);

    await expect(
      strategie.validate({ sub: 'u-1', iat: secondes(change) }),
    ).resolves.toBeTruthy();
  });
});


describe('Production — comptes de démonstration', () => {
  const nodeEnv = process.env.NODE_ENV;
  beforeEach(() => { process.env.NODE_ENV = 'production'; });
  afterEach(() => { process.env.NODE_ENV = nodeEnv; });
  it('refuse la connexion avec le mot de passe public du seed', async () => {
    const prisma = fairePrisma(faireUtilisateur());
    const service = new AuthService(prisma as any, jwt);
    await expect(service.login({ email: 'controleur@unipresence.gn', password: MOT_DE_PASSE }))
      .rejects.toThrow(UnauthorizedException);
    expect(prisma.traces).toHaveLength(0);
  });
  it('refuse aussi un ancien jeton pour ce compte', async () => {
    const strategie = new JwtStrategy(fairePrisma(faireUtilisateur()) as any, configDeTest);
    await expect(strategie.validate({ sub: 'u-1', iat: Math.floor(Date.now() / 1000) }))
      .rejects.toThrow(UnauthorizedException);
  });
  it('conserve un compte muni d’un mot de passe privé', async () => {
    const prisma = fairePrisma(faireUtilisateur({ password: bcrypt.hashSync('Prive-Audit-uniquement-!', 4) }));
    await expect(new AuthService(prisma as any, jwt).login({ email: 'controleur@unipresence.gn', password: 'Prive-Audit-uniquement-!' }))
      .resolves.toMatchObject({ token: 'jeton' });
  });
});
