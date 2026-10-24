import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  appareilActif,
  attestationService,
  libelleAppareil,
  ROLES_GESTION_APPAREILS,
  ROLES_GESTION_MOYENS,
  type AppareilAttestation,
} from '../../src/features/presence/services/attestation';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const appareil: AppareilAttestation = {
  id: 'app1',
  libelle: 'Téléphone du contrôleur',
  actif: true,
  createdAt: '2026-01-05T08:00:00.000Z',
  dernierUsage: '2026-01-06T09:12:00.000Z',
  revoqueLe: null,
  user: { nom: 'Koné', prenom: 'Awa' },
};

describe('features/presence/services/attestation', () => {
  it('liste les appareils de contrôle', async () => {
    api.get.mockResolvedValue({ data: [appareil] });

    await expect(attestationService.appareils()).resolves.toEqual([appareil]);
    expect(api.get).toHaveBeenCalledWith('/attestation/appareils', { params: undefined });
  });

  it('révoque un appareil', async () => {
    api.delete.mockResolvedValue({ data: null });

    await attestationService.revoquerAppareil('app1');

    expect(api.delete).toHaveBeenCalledWith('/attestation/appareils/app1', {});
  });

  it('lit les moyens d’un enseignant', async () => {
    api.get.mockResolvedValue({ data: { codePin: true, empreinte: true, empreinteDoigt: 'index' } });

    await expect(attestationService.moyens('e1')).resolves.toEqual({
      codePin: true,
      empreinte: true,
      empreinteDoigt: 'index',
    });
    expect(api.get).toHaveBeenCalledWith('/attestation/enseignants/e1/moyens', { params: undefined });
  });

  it('définit le code personnel de l’enseignant', async () => {
    api.put.mockResolvedValue({ data: { message: 'Code personnel enregistré' } });

    await attestationService.definirCodePin('e1', '1234');

    expect(api.put).toHaveBeenCalledWith('/attestation/enseignants/e1/code-pin', { code: '1234' }, {});
  });

  it('réinitialise le code : l’API ne le rend qu’une fois', async () => {
    api.post.mockResolvedValue({ data: { code: '482913', message: ' Communiquez ce code' } });

    const reponse = await attestationService.reinitialiserCodePin('e1');

    expect(reponse.code).toBe('482913');
    expect(api.post).toHaveBeenCalledWith('/attestation/enseignants/e1/code-pin/reinitialiser', undefined, {});
  });

  it('retire le code et l’empreinte', async () => {
    api.delete.mockResolvedValue({ data: null });

    await attestationService.supprimerCodePin('e1');
    await attestationService.supprimerEmpreinte('e1');

    expect(api.delete).toHaveBeenCalledWith('/attestation/enseignants/e1/code-pin', {});
    expect(api.delete).toHaveBeenCalledWith('/attestation/enseignants/e1/empreinte', {});
  });

  it('nomme un appareil avec son contrôleur', () => {
    expect(libelleAppareil(appareil)).toBe('Téléphone du contrôleur — Awa Koné');
    expect(libelleAppareil({ ...appareil, user: null })).toBe('Téléphone du contrôleur');
  });

  it('considère un appareil révoqué comme inactif', () => {
    expect(appareilActif(appareil)).toBe(true);
    expect(appareilActif({ ...appareil, actif: false })).toBe(false);
    expect(appareilActif({ ...appareil, revoqueLe: '2026-01-07T08:00:00.000Z' })).toBe(false);
  });

  it('aligne les rôles sur les @Roles de l’API', () => {
    // GET /attestation/appareils et DELETE /attestation/appareils/:id.
    expect([...ROLES_GESTION_APPAREILS]).toEqual(['ADMIN', 'DIRECTION']);
    // Les moyens d'un enseignant : administration, scolarité, chef de département, direction.
    expect([...ROLES_GESTION_MOYENS]).toEqual(['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION']);
  });
});
