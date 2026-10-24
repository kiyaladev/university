/**
 * Signature : la passerelle doit produire exactement ce que l'API vérifie.
 *
 * L'algorithme de l'API est reproduit ici, sans importer le backend : le test
 * reste valable même si le backend change de module, et il montre la charge
 * reconstruite champ par champ. Les vecteurs sont figés — une charge qui
 * change d'un octet change la signature, et le test doit le voir.
 */
import { describe, expect, it } from 'bun:test';
import { createHash, createHmac } from 'node:crypto';
import {
  chargeEnrolement,
  chargeVerification,
  empreinteGabarit,
  FRAICHEUR_RESULTAT_MS,
  horodatageAcceptable,
  signer,
} from '../src/signature';

const SECRET = 'cle-de-test-0001';
const APPAREIL = 'appareil-1';
const ENSEIGNANT = 'ens-1';
const GABARIT = 'GABARIT-TEST-0001';

/** Algorithme de l'API, tel que le backend le reconstruit. */
function apiChargeEnrolement(params: {
  appareilId?: string;
  enseignantId: string;
  template: string;
  horodatage: string;
}): string {
  return params.appareilId
    ? `enrolement|${params.appareilId}|${params.enseignantId}|${params.template}|${params.horodatage}`
    : `enrolement|${params.enseignantId}|${params.template}|${params.horodatage}`;
}

function apiChargeVerification(params: {
  appareilId?: string;
  enseignantId: string;
  template: string;
  score: number;
  horodatage: string;
  tentativeId?: string;
}): string {
  const gabarit = createHash('sha256').update(params.template).digest('hex');
  const base = params.appareilId
    ? `verification|${params.appareilId}|${params.enseignantId}|${gabarit}|${params.score}`
    : `verification|${params.enseignantId}|${gabarit}|${params.score}`;
  // L'API accepte le nonce en fin de charge (c'est la forme produite ici) et
  // juste avant l'horodatage.
  return params.tentativeId ? `${base}|${params.horodatage}|${params.tentativeId}` : `${base}|${params.horodatage}`;
}

function apiVerifie(params: {
  appareilId?: string;
  secret: string;
  charge: string;
  signature: string;
}): boolean {
  const attendue = createHmac('sha256', params.secret).update(params.charge).digest('hex');
  return attendue === params.signature;
}

describe('Signature — charges conforme à celles de l’API', () => {
  it('compose la charge d’enrôlement par appareil comme l’API', () => {
    const params = {
      appareilId: APPAREIL,
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      horodatage: '2026-10-24T08:00:00.000Z',
    };
    expect(chargeEnrolement(params)).toBe(apiChargeEnrolement(params));
    expect(chargeEnrolement(params)).toBe(
      'enrolement|appareil-1|ens-1|GABARIT-TEST-0001|2026-10-24T08:00:00.000Z',
    );
  });

  it('compose la charge d’enrôlement sans appareil comme l’API', () => {
    const params = {
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      horodatage: '2026-10-24T08:00:00.000Z',
    };
    expect(chargeEnrolement(params)).toBe(apiChargeEnrolement(params));
    expect(chargeEnrolement(params)).toBe('enrolement|ens-1|GABARIT-TEST-0001|2026-10-24T08:00:00.000Z');
  });

  it('compose la charge de vérification par appareil comme l’API', () => {
    const params = {
      appareilId: APPAREIL,
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      score: 88,
      horodatage: '2026-10-24T08:00:00.000Z',
    };
    const gabarit = empreinteGabarit(GABARIT);
    expect(chargeVerification({ ...params, gabarit })).toBe(apiChargeVerification(params));
    expect(chargeVerification({ ...params, gabarit })).toBe(
      `verification|appareil-1|ens-1|${gabarit}|88|2026-10-24T08:00:00.000Z`,
    );
  });

  it('compose la charge de vérification sans appareil comme l’API', () => {
    const params = {
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      score: 88,
      horodatage: '2026-10-24T08:00:00.000Z',
    };
    const gabarit = empreinteGabarit(GABARIT);
    expect(chargeVerification({ ...params, gabarit })).toBe(apiChargeVerification(params));
  });

  it('compose la charge de vérification avec le nonce comme l’API', () => {
    const params = {
      appareilId: APPAREIL,
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      score: 88,
      horodatage: '2026-10-24T08:00:00.000Z',
      tentativeId: 'tentative-1',
    };
    const gabarit = empreinteGabarit(GABARIT);
    expect(chargeVerification({ ...params, gabarit })).toBe(apiChargeVerification(params));
    expect(chargeVerification({ ...params, gabarit })).toBe(
      `verification|appareil-1|ens-1|${gabarit}|88|2026-10-24T08:00:00.000Z|tentative-1`,
    );
  });

  it('compose la charge de vérification avec le nonce sans appareil comme l’API', () => {
    const params = {
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      score: 88,
      horodatage: '2026-10-24T08:00:00.000Z',
      tentativeId: 'tentative-1',
    };
    const gabarit = empreinteGabarit(GABARIT);
    expect(chargeVerification({ ...params, gabarit })).toBe(apiChargeVerification(params));
  });

  it('reprend le SHA-256 du gabarit comme empreinte', () => {
    expect(empreinteGabarit(GABARIT)).toBe(createHash('sha256').update(GABARIT).digest('hex'));
    expect(empreinteGabarit(GABARIT)).toHaveLength(64);
  });
});

describe('Signature — vecteurs figés', () => {
  it('signe l’enrôlement par appareil comme l’API (vecteur figé)', () => {
    const params = {
      appareilId: APPAREIL,
      secret: SECRET,
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      horodatage: '2026-10-24T08:00:00.000Z',
    };
    const charge = apiChargeEnrolement(params);
    const signature = signer(SECRET, charge);

    expect(signature).toBe('5f3b049d6a9f69577cac3f0a3b5d19e3758bcad3c604c7230e37adfb2de66135');
    expect(apiVerifie({ appareilId: APPAREIL, secret: SECRET, charge, signature })).toBe(true);
  });

  it('signe l’enrôlement sans appareil comme l’API (vecteur figé)', () => {
    const params = {
      secret: SECRET,
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      horodatage: '2026-10-24T08:00:00.000Z',
    };
    const charge = apiChargeEnrolement(params);
    const signature = signer(SECRET, charge);

    expect(signature).toBe('0257f67b2d6bff9412a6d44a344ab6b0dfa08d5bdfc093e905f5e8ff55bf763c');
    expect(apiVerifie({ secret: SECRET, charge, signature })).toBe(true);
  });

  it('signe la vérification par appareil comme l’API (vecteur figé)', () => {
    const params = {
      appareilId: APPAREIL,
      secret: SECRET,
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      score: 88,
      horodatage: '2026-10-24T08:00:00.000Z',
    };
    const charge = apiChargeVerification(params);
    const signature = signer(SECRET, charge);

    expect(signature).toBe('96da097823f87c6245012ee39427b881aad1f7464a3d8a1c0c6d93b6180a8459');
    expect(apiVerifie({ appareilId: APPAREIL, secret: SECRET, charge, signature })).toBe(true);
  });

  it('signe la vérification sans appareil comme l’API (vecteur figé)', () => {
    const params = {
      secret: SECRET,
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      score: 88,
      horodatage: '2026-10-24T08:00:00.000Z',
    };
    const charge = apiChargeVerification(params);
    const signature = signer(SECRET, charge);

    expect(signature).toBe('d148681e391d083cd2ed97161b2757f1e9b96865c40b1e95cafbe8b57af50287');
    expect(apiVerifie({ secret: SECRET, charge, signature })).toBe(true);
  });

  it('signe la vérification avec le nonce comme l’API (vecteur figé)', () => {
    const params = {
      appareilId: APPAREIL,
      secret: SECRET,
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      score: 88,
      horodatage: '2026-10-24T08:00:00.000Z',
      tentativeId: 'tentative-1',
    };
    const charge = apiChargeVerification(params);
    const signature = signer(SECRET, charge);

    expect(signature).toBe('130cfb28626bb646baf164284a8c5d6d3c7d4fa98e4ca08030c7d23c2e08be7f');
    expect(apiVerifie({ appareilId: APPAREIL, secret: SECRET, charge, signature })).toBe(true);
  });

  it('signe la vérification avec le nonce sans appareil comme l’API (vecteur figé)', () => {
    const params = {
      secret: SECRET,
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      score: 88,
      horodatage: '2026-10-24T08:00:00.000Z',
      tentativeId: 'tentative-1',
    };
    const charge = apiChargeVerification(params);
    const signature = signer(SECRET, charge);

    expect(signature).toBe('9e724430594a9043ee68c9f252c47700cb991c23409dababa6d206aa45552718');
    expect(apiVerifie({ secret: SECRET, charge, signature })).toBe(true);
  });

  it('change la charge et la signature quand le nonce change', () => {
    const base = {
      enseignantId: ENSEIGNANT,
      template: GABARIT,
      score: 88,
      horodatage: '2026-10-24T08:00:00.000Z',
    };
    const gabarit = empreinteGabarit(GABARIT);
    const un = signer(SECRET, chargeVerification({ ...base, gabarit, tentativeId: 'tentative-1' }));
    const deux = signer(SECRET, chargeVerification({ ...base, gabarit, tentativeId: 'tentative-2' }));
    expect(un).not.toBe(deux);
  });

  it('produit une signature différente pour chaque appareil', () => {
    const base = { enseignantId: ENSEIGNANT, template: GABARIT, score: 88, horodatage: '2026-10-24T08:00:00.000Z' };
    const gabarit = empreinteGabarit(GABARIT);
    const un = signer(SECRET, chargeVerification({ ...base, gabarit, appareilId: 'appareil-1' }));
    const deux = signer(SECRET, chargeVerification({ ...base, gabarit, appareilId: 'appareil-2' }));
    expect(un).not.toBe(deux);
  });
});

describe('Signature — fenêtre d’acceptation de l’API', () => {
  const maintenant = new Date('2026-10-24T08:00:00.000Z').getTime();

  it('accepte un horodatage récent', () => {
    expect(horodatageAcceptable('2026-10-24T07:58:00.000Z', maintenant)).toBe(true);
  });

  it('refuse un horodatage trop ancien', () => {
    expect(horodatageAcceptable('2026-10-24T07:50:00.000Z', maintenant)).toBe(false);
  });

  it('tolère une légère dérive d’horloge', () => {
    expect(horodatageAcceptable('2026-10-24T08:00:30.000Z', maintenant)).toBe(true);
    expect(horodatageAcceptable('2026-10-24T08:02:00.000Z', maintenant)).toBe(false);
  });

  it('refuse un horodatage illisible', () => {
    expect(horodatageAcceptable('pas-une-date', maintenant)).toBe(false);
  });

  it('utilise la fenêtre de cinq minutes de l’API', () => {
    expect(FRAICHEUR_RESULTAT_MS).toBe(5 * 60 * 1000);
  });
});
