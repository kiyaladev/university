/** Règles d'attestation : code personnel, empreinte signée, clé d'accès. */
import { BadRequestException } from '@nestjs/common';
import { AttestationMode, Role } from '@prisma/client';
import { createHash, createHmac } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { MoyensAttestationService } from './moyens-attestation.service';
import { AuthUser } from '../../common/decorators';
import { dechiffrer, estChiffre, oublierCle } from '../../common/coffre';

const SECRET = 'secret-de-test';
process.env.BIOMETRIE_SECRET = SECRET;

const ADMIN: AuthUser = {
  id: 'u-admin',
  email: 'admin@unipresence.gn',
  nom: 'ADMIN',
  prenom: 'Système',
  role: Role.ADMIN,
  departementId: null,
  enseignantId: null,
  etudiantId: null,
};

const ENSEIGNANT_USER: AuthUser = { ...ADMIN, id: 'u-ens', role: Role.ENSEIGNANT, enseignantId: 'ens-1' };
const AUTRE_ENSEIGNANT: AuthUser = { ...ENSEIGNANT_USER, id: 'u-ens2', enseignantId: 'ens-2' };

const GABARIT = 'SIMU-ENS-001';
const SECRET_APPAREIL = 'cle-propre-a-ce-telephone';
const empreinteGabarit = createHash('sha256').update(GABARIT).digest('hex');

function signer(charge: string) {
  return createHmac('sha256', SECRET).update(charge).digest('hex');
}

/** Signature telle que la produirait la passerelle biométrique. */
function signerVerification(enseignantId: string, score: number, horodatage: string, gabarit = empreinteGabarit) {
  return signer(`verification|${enseignantId}|${gabarit}|${score}|${horodatage}`);
}

function preparer(options: { enseignant?: any; seuil?: number; appareil?: any } = {}) {
  const enseignant = {
    id: 'ens-1',
    nom: 'CAMARA',
    prenom: 'Mamadou',
    matricule: 'ENS-001',
    codePin: null,
    empreinteTemplate: null,
    ...(options.enseignant ?? {}),
  };

  const prisma = {
    enseignant: {
      findUnique: jest.fn().mockResolvedValue(enseignant),
      update: jest.fn().mockResolvedValue(enseignant),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    appareil: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.appareil === undefined
            ? { id: 'appareil-1', secret: SECRET_APPAREIL, actif: true }
            : options.appareil,
        ),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn(({ data }: any) => Promise.resolve({ id: 'appareil-neuf', actif: true, ...data })),
    },
    seance: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  prisma.$transaction = jest.fn(async (operation: (tx: any) => unknown) => operation(prisma));

  const parametres = {
    nombre: jest.fn(async (_cle: string, defaut: number) => options.seuil ?? defaut),
    booleen: jest.fn(async (_cle: string, defaut: boolean) => defaut),
  } as any;

  return { service: new MoyensAttestationService(prisma, parametres), prisma, enseignant };
}

describe('Attestation — code personnel', () => {
  it('valide un code correct', async () => {
    const { service } = preparer({
      enseignant: { codePin: await bcrypt.hash('4321', 10) },
    });
    const res = await service.verifierPreuves('ens-1', { codePinEnseignant: '4321' });
    expect(res).toEqual({ mode: AttestationMode.CODE_PIN, valide: true });
  });

  it('rejette un code erroné', async () => {
    const { service } = preparer({
      enseignant: { codePin: await bcrypt.hash('4321', 10) },
    });
    await expect(service.verifierPreuves('ens-1', { codePinEnseignant: '0000' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('signale l’absence de code défini', async () => {
    const { service } = preparer();
    await expect(service.verifierPreuves('ens-1', { codePinEnseignant: '4321' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('interdit à un enseignant de définir un code, même le sien', async () => {
    const { service } = preparer();
    await expect(service.definirCodePin('ens-1', { code: '1234' }, ENSEIGNANT_USER)).rejects.toThrow();
    await expect(service.definirCodePin('ens-2', { code: '1234' }, AUTRE_ENSEIGNANT)).rejects.toThrow();
  });

  it('laisse l’administration réinitialiser un code', async () => {
    const { service, prisma } = preparer();
    const res = await service.reinitialiserCodePin('ens-1', ADMIN);
    expect(res.code).toMatch(/^\d{6}$/);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ADMIN.id,
        action: 'PIN_REINITIALISE',
        entite: 'Enseignant',
        entiteId: 'ens-1',
      },
    });
    expect(JSON.stringify(prisma.auditLog.create.mock.calls[0][0].data)).not.toContain(res.code);
  });

  it('journalise la suppression du code dans la transaction sans valeur secrète', async () => {
    const { service, prisma } = preparer({ enseignant: { codePin: await bcrypt.hash('1234', 10) } });

    await service.supprimerCodePin('ens-1', ADMIN);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.enseignant.update).toHaveBeenCalledWith({
      where: { id: 'ens-1' },
      data: { codePin: null, codePinDefiniLe: null },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ADMIN.id,
        action: 'PIN_SUPPRIME',
        entite: 'Enseignant',
        entiteId: 'ens-1',
      },
    });
    expect(JSON.stringify(prisma.auditLog.create.mock.calls[0][0].data)).not.toContain('1234');
  });
});

describe('Attestation — enrôlement de l’empreinte', () => {
  const horodatage = () => new Date().toISOString();
  const signerEnrolement = (id: string, h: string) => signer(`enrolement|${id}|${GABARIT}|${h}`);

  it('refuse d’enrôler sans le consentement de l’enseignant', async () => {
    const { service, prisma } = preparer();
    const h = horodatage();

    await expect(
      service.enrolerEmpreinte(
        'ens-1',
        { template: GABARIT, horodatage: h, signature: signerEnrolement('ens-1', h), consentement: false },
        ADMIN,
      ),
    ).rejects.toThrow(/consentir/);

    expect(prisma.enseignant.update).not.toHaveBeenCalled();
  });

  it('chiffre le gabarit et retient qui a recueilli le consentement', async () => {
    process.env.BIOMETRIE_CHIFFREMENT_CLE = 'c'.repeat(64);
    oublierCle();

    const { service, prisma } = preparer();
    const h = horodatage();
    await service.enrolerEmpreinte(
      'ens-1',
      { template: GABARIT, horodatage: h, signature: signerEnrolement('ens-1', h), consentement: true },
      ADMIN,
    );

    const { data } = prisma.enseignant.update.mock.calls[0][0];
    expect(data.empreinteTemplate).not.toContain(GABARIT);
    expect(estChiffre(data.empreinteTemplate)).toBe(true);
    expect(dechiffrer(data.empreinteTemplate)).toBe(GABARIT);
    expect(data.empreinteConsentementLe).toBeInstanceOf(Date);
    expect(data.empreinteConsentementPar).toContain('ADMIN');
  });

  it('efface tout, consentement compris, à la suppression', async () => {
    const { service, prisma } = preparer({ enseignant: { empreinteTemplate: GABARIT } });
    await service.supprimerEmpreinte('ens-1', ADMIN);

    const { data } = prisma.enseignant.update.mock.calls[0][0];
    expect(data).toMatchObject({
      empreinteTemplate: null,
      empreinteConsentementLe: null,
      empreinteConsentementPar: null,
    });
  });
});

describe('Attestation — transaction d’écriture de l’empreinte', () => {
  const horodatage = () => new Date().toISOString();
  const signerEnrolement = (id: string, h: string) => signer(`enrolement|${id}|${GABARIT}|${h}`);

  /** Service dont la transaction est distincte du client : on voit ce qui part par `tx`. */
  function preparerTransaction() {
    const base = preparer();
    const tx: any = {
      enseignant: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    base.prisma.$transaction = jest.fn(async (operation: (t: any) => unknown) => operation(tx));
    return { ...base, tx };
  }

  it('écrit l’empreinte et sa trace dans la même transaction', async () => {
    process.env.BIOMETRIE_CHIFFREMENT_CLE = 'c'.repeat(64);
    oublierCle();

    const { service, prisma, tx } = preparerTransaction();
    const h = horodatage();
    await service.enrolerEmpreinte(
      'ens-1',
      { template: GABARIT, horodatage: h, signature: signerEnrolement('ens-1', h), consentement: true },
      ADMIN,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.enseignant.update).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('EMPREINTE_ENROLEE');
    // Rien ne sort de la transaction.
    expect(prisma.enseignant.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('efface l’empreinte et sa trace dans la même transaction', async () => {
    const { service, prisma, tx } = preparerTransaction();

    await service.supprimerEmpreinte('ens-1', ADMIN);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.enseignant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ens-1' },
        data: expect.objectContaining({ empreinteTemplate: null, empreinteConsentementPar: null }),
      }),
    );
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('EMPREINTE_SUPPRIMEE');
    expect(prisma.enseignant.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('abandonne l’enrôlement si la trace ne peut pas être écrite', async () => {
    process.env.BIOMETRIE_CHIFFREMENT_CLE = 'c'.repeat(64);
    oublierCle();

    const { service, tx } = preparerTransaction();
    tx.auditLog.create.mockRejectedValue(new Error('journal indisponible'));
    const h = horodatage();

    await expect(
      service.enrolerEmpreinte(
        'ens-1',
        { template: GABARIT, horodatage: h, signature: signerEnrolement('ens-1', h), consentement: true },
        ADMIN,
      ),
    ).rejects.toThrow('journal indisponible');
  });
});

describe('Attestation — purge biométrique', () => {
  function preparerPurge(echecJournal = false) {
    const base: any = {
      id: 'ens-purge',
      empreinteTemplate: 'gabarit-chiffre-confidentiel',
      empreinteDoigt: 'INDEX',
      empreinteEnroleeLe: new Date('2025-01-01T00:00:00.000Z'),
      empreinteConsentementLe: new Date('2025-01-01T00:00:00.000Z'),
      empreinteConsentementPar: 'u-admin',
    };
    const audit: any[] = [];
    const tx = {
      enseignant: {
        findMany: jest.fn().mockResolvedValue([{ id: base.id }]),
        updateMany: jest.fn(async () => {
          base.empreinteTemplate = null;
          base.empreinteDoigt = null;
          base.empreinteEnroleeLe = null;
          base.empreinteConsentementLe = null;
          base.empreinteConsentementPar = null;
          return { count: 1 };
        }),
      },
      auditLog: {
        createMany: jest.fn(async ({ data }: any) => {
          if (echecJournal) throw new Error('journal indisponible');
          audit.push(...data);
          return { count: data.length };
        }),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (operation: any) => {
        const avant = { ...base };
        const auditAvant = [...audit];
        try {
          return await operation(tx);
        } catch (error) {
          Object.assign(base, avant);
          audit.splice(0, audit.length, ...auditAvant);
          throw error;
        }
      }),
    };
    const parametres: any = { nombre: jest.fn(async (_cle: string, defaut: number) => defaut) };
    return { service: new MoyensAttestationService(prisma, parametres), prisma, tx, base, audit };
  }

  it('purge les champs biométriques et journalise la purge dans une transaction', async () => {
    const { service, prisma, tx, base, audit } = preparerPurge();

    await expect(service.purgerEmpreintesPerimees()).resolves.toEqual({ purges: 1 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.enseignant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['ens-purge'] } },
      }),
    );
    expect(audit).toEqual([
      expect.objectContaining({
        action: 'EMPREINTE_PURGEE',
        entite: 'Enseignant',
        entiteId: 'ens-purge',
      }),
    ]);
    expect(base.empreinteTemplate).toBeNull();
    expect(JSON.stringify(audit)).not.toContain('gabarit-chiffre-confidentiel');
  });

  it('annule la purge si le journal ne peut pas être écrit', async () => {
    const { service, base, audit } = preparerPurge(true);

    await expect(service.purgerEmpreintesPerimees()).rejects.toThrow('journal indisponible');

    expect(base.empreinteTemplate).toBe('gabarit-chiffre-confidentiel');
    expect(audit).toEqual([]);
  });
});

describe('Accès au gabarit biométrique', () => {
  it('limite les moyens d’attestation d’un chef à son département', async () => {
    const { service } = preparer({ enseignant: { id: 'ens-3', departementId: 'dept-2' } });
    const chef: AuthUser = { ...ADMIN, role: Role.CHEF_DEPARTEMENT, departementId: 'dept-1' };
    await expect(service.moyens('ens-3', chef)).rejects.toThrow();
  });

  it('ne révèle pas les moyens au contrôleur sans séance du jour', async () => {
    const { service, prisma } = preparer({ enseignant: { codePin: 'hash', empreinteTemplate: 'chiffre' } });
    const controleur: AuthUser = { ...ADMIN, id: 'ctrl-1', role: Role.CONTROLEUR };

    await expect(service.moyens('ens-1', controleur)).rejects.toThrow();
    expect(prisma.seance.findFirst).not.toHaveBeenCalled();
    expect(prisma.enseignant.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('limite les moyens du contrôleur à sa séance et journalise la consultation', async () => {
    const { service, prisma } = preparer({
      enseignant: { codePin: 'hash', empreinteTemplate: 'chiffre', empreinteDoigt: 'POUCE' },
    });
    const controleur: AuthUser = { ...ADMIN, id: 'ctrl-1', role: Role.CONTROLEUR };
    prisma.seance.findFirst.mockResolvedValue({
      id: 'seance-1',
      controleurAssigneId: 'ctrl-1',
      controle: null,
      affectation: { enseignant: { departementId: 'dept-2' } },
    });

    await expect(service.moyens('ens-1', controleur, 'seance-1')).resolves.toEqual({
      codePin: true,
      empreinte: true,
      empreinteDoigt: 'POUCE',
    });
    expect(prisma.seance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'seance-1', affectation: { enseignantId: 'ens-1' } }),
      }),
    );
    expect(prisma.enseignant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ens-1', actif: true },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'ctrl-1',
        action: 'MOYENS_ATTESTATION_CONSULTES',
        entiteId: 'ens-1',
        details: JSON.stringify({ seanceId: 'seance-1', role: Role.CONTROLEUR }),
      }),
    });
  });

  it('refuse tout rôle sans séance du jour pour cet enseignant', async () => {
    const { service, prisma } = preparer();
    await expect(service.gabarit('ens-1', 'seance-etrangere', ADMIN)).rejects.toThrow();
    expect(prisma.seance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'seance-etrangere', affectation: { enseignantId: 'ens-1' } }),
      }),
    );
    expect(prisma.enseignant.findUnique).not.toHaveBeenCalled();
  });

  it('refuse une séance absente avant toute requête Prisma', async () => {
    const { service, prisma } = preparer();
    await expect(service.gabarit('ens-1', undefined as any, ADMIN)).rejects.toThrow();
    expect(prisma.seance.findFirst).not.toHaveBeenCalled();
  });

  it('réserve le gabarit au contrôleur affecté et journalise chaque lecture', async () => {
    const { service, prisma } = preparer({ enseignant: { empreinteTemplate: GABARIT } });
    const controleur: AuthUser = { ...ADMIN, id: 'u-controleur', role: Role.CONTROLEUR };
    prisma.seance.findFirst.mockResolvedValue({
      id: 'seance-1',
      controleurAssigneId: 'autre',
      controle: { controleurId: 'autre' },
    });
    await expect(service.gabarit('ens-1', 'seance-1', controleur)).rejects.toThrow();
    expect(prisma.enseignant.findUnique).not.toHaveBeenCalled();

    prisma.seance.findFirst.mockResolvedValue({
      id: 'seance-1',
      controleurAssigneId: 'u-controleur',
      controle: null,
    });
    await expect(service.gabarit('ens-1', 'seance-1', controleur)).resolves.toMatchObject({ template: GABARIT });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u-controleur',
          action: 'GABARIT_BIOMETRIQUE_CONSULTE',
          entiteId: 'ens-1',
        }),
      }),
    );
  });
});

describe('Attestation — empreinte digitale', () => {
  const horodatage = () => new Date().toISOString();
  const enrole = { empreinteTemplate: GABARIT };

  it('accepte un résultat correctement signé par la passerelle', async () => {
    const { service } = preparer({ enseignant: enrole });
    const h = horodatage();
    const res = await service.verifierPreuves('ens-1', {
      empreinte: { score: 82, horodatage: h, signature: signerVerification('ens-1', 82, h) },
    });
    expect(res).toMatchObject({ mode: AttestationMode.EMPREINTE, valide: true, score: 82 });
  });

  it('refuse un résultat non signé (client qui prétendrait avoir vérifié)', async () => {
    const { service } = preparer({ enseignant: enrole });
    const h = horodatage();
    await expect(
      service.verifierPreuves('ens-1', {
        empreinte: { score: 99, horodatage: h, signature: 'faux' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un résultat signé pour un autre enseignant', async () => {
    const { service } = preparer({ enseignant: enrole });
    const h = horodatage();
    await expect(
      service.verifierPreuves('ens-1', {
        empreinte: { score: 90, horodatage: h, signature: signerVerification('ens-2', 90, h) },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une comparaison faite sur un autre gabarit que celui enrôlé', async () => {
    const { service } = preparer({ enseignant: enrole });
    const h = horodatage();
    const gabaritEtranger = createHash('sha256').update('DOIGT-DU-CONTROLEUR').digest('hex');
    await expect(
      service.verifierPreuves('ens-1', {
        empreinte: {
          score: 97,
          horodatage: h,
          signature: signerVerification('ens-1', 97, h, gabaritEtranger),
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un résultat périmé', async () => {
    const { service } = preparer({ enseignant: enrole });
    const vieux = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await expect(
      service.verifierPreuves('ens-1', {
        empreinte: { score: 90, horodatage: vieux, signature: signerVerification('ens-1', 90, vieux) },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un score inférieur au seuil de l’établissement', async () => {
    const { service } = preparer({ enseignant: enrole, seuil: 70 });
    const h = horodatage();
    await expect(
      service.verifierPreuves('ens-1', {
        empreinte: { score: 55, horodatage: h, signature: signerVerification('ens-1', 55, h) },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse en production la clé d’exemple publique de la passerelle', async () => {
    const { service } = preparer({ enseignant: enrole });
    const h = horodatage();
    const exemple = 'change-me-biometrie';
    const signatureForgee = createHmac('sha256', exemple)
      .update(`verification|ens-1|${empreinteGabarit}|100|${h}`)
      .digest('hex');
    const avant = { secret: process.env.BIOMETRIE_SECRET, env: process.env.NODE_ENV };
    try {
      process.env.NODE_ENV = 'production';
      for (const valeur of [undefined, exemple]) {
        if (valeur === undefined) delete process.env.BIOMETRIE_SECRET;
        else process.env.BIOMETRIE_SECRET = valeur;
        await expect(
          service.verifierPreuves('ens-1', {
            empreinte: { score: 100, horodatage: h, signature: signatureForgee },
          }),
        ).rejects.toThrow('Passerelle biométrique non configurée');
      }
    } finally {
      process.env.BIOMETRIE_SECRET = avant.secret;
      process.env.NODE_ENV = avant.env;
    }
  });

  it('refuse une empreinte pour un enseignant non enrôlé', async () => {
    const { service } = preparer();
    const h = horodatage();
    await expect(
      service.verifierPreuves('ens-1', {
        empreinte: { score: 95, horodatage: h, signature: signerVerification('ens-1', 95, h) },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Attestation — hiérarchie des moyens', () => {
  it('retient le moyen le plus fort quand plusieurs sont présentés', async () => {
    const { service } = preparer({
      enseignant: { codePin: await bcrypt.hash('4321', 10), empreinteTemplate: GABARIT },
    });
    const h = new Date().toISOString();
    const res = await service.verifierPreuves('ens-1', {
      signatureBase64: 'data:image/png;base64,xxx',
      codePinEnseignant: '4321',
      empreinte: { score: 88, horodatage: h, signature: signerVerification('ens-1', 88, h) },
    });
    expect(res.mode).toBe(AttestationMode.EMPREINTE);
  });

  it('accepte la signature manuscrite comme moyen de dernier recours', async () => {
    const { service } = preparer();
    const res = await service.verifierPreuves('ens-1', {
      signatureBase64: 'data:image/png;base64,xxx',
    });
    expect(res).toEqual({ mode: AttestationMode.SIGNATURE, valide: true });
  });

  it('ne valide rien quand aucun moyen n’est fourni', async () => {
    const { service } = preparer();
    const res = await service.verifierPreuves('ens-1', {});
    expect(res).toEqual({ mode: AttestationMode.AUCUNE, valide: false });
  });
});

describe('Attestation — lecture signée par un appareil', () => {
  const horodatage = () => new Date().toISOString();

  const signerAppareil = (appareilId: string, score: number, h: string, secret = SECRET_APPAREIL) =>
    createHmac('sha256', secret)
      .update(`verification|${appareilId}|ens-1|${empreinteGabarit}|${score}|${h}`)
      .digest('hex');

  it('accepte une lecture signée avec la clé de l’appareil', async () => {
    const { service } = preparer({ enseignant: { empreinteTemplate: GABARIT } });
    const h = horodatage();

    const res = await service.verifierPreuves('ens-1', {
      empreinte: {
        score: 88,
        horodatage: h,
        signature: signerAppareil('appareil-1', 88, h),
        appareilId: 'appareil-1',
      },
    });

    expect(res).toMatchObject({ mode: AttestationMode.EMPREINTE, valide: true, score: 88 });
  });

  it('refuse une lecture signée avec la clé d’un autre appareil', async () => {
    const { service } = preparer({ enseignant: { empreinteTemplate: GABARIT } });
    const h = horodatage();

    await expect(
      service.verifierPreuves('ens-1', {
        empreinte: {
          score: 88,
          horodatage: h,
          signature: signerAppareil('appareil-1', 88, h, 'la-cle-du-voisin'),
          appareilId: 'appareil-1',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse la lecture d’un appareil révoqué', async () => {
    const { service } = preparer({
      enseignant: { empreinteTemplate: GABARIT },
      appareil: { id: 'appareil-1', secret: SECRET_APPAREIL, actif: false },
    });
    const h = horodatage();

    await expect(
      service.verifierPreuves('ens-1', {
        empreinte: {
          score: 88,
          horodatage: h,
          signature: signerAppareil('appareil-1', 88, h),
          appareilId: 'appareil-1',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un résultat rejoué au nom d’un autre appareil', async () => {
    const { service } = preparer({ enseignant: { empreinteTemplate: GABARIT } });
    const h = horodatage();

    // Signature produite pour « appareil-2 », présentée comme venant d'« appareil-1 ».
    await expect(
      service.verifierPreuves('ens-1', {
        empreinte: {
          score: 88,
          horodatage: h,
          signature: signerAppareil('appareil-2', 88, h),
          appareilId: 'appareil-1',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remet une clé propre à chaque appareil enrôlé', async () => {
    const { service, prisma } = preparer();
    const res = await service.enrolerAppareil('Téléphone de Facinet', ADMIN);

    expect(res.secret).toHaveLength(64);
    expect(prisma.appareil.create).toHaveBeenCalled();
    // La clé du serveur global ne doit jamais servir de clé d'appareil.
    expect(res.secret).not.toBe(SECRET);
  });
});

describe('Attestation — journal des appareils', () => {
  it('crée un appareil et son journal dans la même transaction sans tracer le secret', async () => {
    const { service, prisma } = preparer();
    const resultat = await service.enrolerAppareil('Tablette terrain', ADMIN);
    const audit = prisma.auditLog.create.mock.calls[0][0].data;

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit).toMatchObject({
      userId: ADMIN.id,
      action: 'APPAREIL_ENROLE',
      entite: 'Appareil',
      entiteId: resultat.appareilId,
    });
    expect(audit.details).not.toContain(resultat.secret);
    expect(JSON.parse(audit.details)).toMatchObject({
      avant: null,
      apres: { libelle: 'Tablette terrain', actif: true },
    });
  });

  it('révoque un appareil et journalise son état avant/après dans la même transaction', async () => {
    const { service, prisma } = preparer();
    const avant = { id: 'appareil-1', libelle: 'Tablette terrain', actif: true };
    const apres = { ...avant, actif: false, revoqueLe: new Date() };
    prisma.appareil.findUnique.mockResolvedValue(avant);
    prisma.appareil.update.mockResolvedValue(apres);

    await service.revoquerAppareil('appareil-1', ADMIN);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      userId: ADMIN.id,
      action: 'APPAREIL_REVOQUE',
      entite: 'Appareil',
      entiteId: 'appareil-1',
    });
    expect(JSON.parse(audit.details)).toEqual({
      avant: { libelle: 'Tablette terrain', actif: true },
      apres: { libelle: 'Tablette terrain', actif: false },
      champsModifies: ['actif'],
    });
  });
});
