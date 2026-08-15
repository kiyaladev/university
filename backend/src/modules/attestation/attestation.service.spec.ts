/** Règles d'attestation : code personnel, empreinte signée, clé d'accès. */
import { BadRequestException } from '@nestjs/common';
import { AttestationMode, Role } from '@prisma/client';
import { createHash, createHmac } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { AttestationService } from './attestation.service';
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
      findUnique: jest.fn().mockResolvedValue(
        options.appareil === undefined
          ? { id: 'appareil-1', secret: SECRET_APPAREIL, actif: true }
          : options.appareil,
      ),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn(({ data }: any) => Promise.resolve({ id: 'appareil-neuf', ...data })),
    },
  } as any;

  const parametres = {
    nombre: jest.fn(async (_cle: string, defaut: number) => options.seuil ?? defaut),
    booleen: jest.fn(async (_cle: string, defaut: boolean) => defaut),
  } as any;

  return { service: new AttestationService(prisma, parametres), prisma, enseignant };
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
    await expect(
      service.verifierPreuves('ens-1', { codePinEnseignant: '0000' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signale l’absence de code défini', async () => {
    const { service } = preparer();
    await expect(
      service.verifierPreuves('ens-1', { codePinEnseignant: '4321' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('interdit à un enseignant de définir un code, même le sien', async () => {
    const { service } = preparer();
    await expect(
      service.definirCodePin('ens-1', { code: '1234' }, ENSEIGNANT_USER),
    ).rejects.toThrow();
    await expect(
      service.definirCodePin('ens-2', { code: '1234' }, AUTRE_ENSEIGNANT),
    ).rejects.toThrow();
  });

  it('laisse l’administration réinitialiser un code', async () => {
    const { service } = preparer();
    const res = await service.reinitialiserCodePin('ens-1', ADMIN);
    expect(res.code).toMatch(/^\d{6}$/);
  });
});

describe('Attestation — enrôlement de l’empreinte', () => {
  const horodatage = () => new Date().toISOString();
  const signerEnrolement = (id: string, h: string) =>
    signer(`enrolement|${id}|${GABARIT}|${h}`);

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
    ).rejects.toThrow(/révoqué/);
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
