import { beforeEach, describe, expect, it, vi } from 'vitest';

type Reponse = 'ok' | 'annuler';

// Faux $q.dialog : enregistre ses options et répond selon `etat.reponse`.
const etat = vi.hoisted(() => ({
  reponse: 'ok' as 'ok' | 'annuler',
  dialogues: [] as Array<Record<string, unknown>>,
  notify: [] as Array<Record<string, unknown>>,
}));
const api = vi.hoisted(() => ({ delete: vi.fn() }));

vi.mock('quasar', () => ({
  useQuasar: () => ({
    dialog(options: Record<string, unknown>) {
      etat.dialogues.push(options);
      const chaine = {
        onOk(fn: (saisie?: string) => void) {
          if (etat.reponse === 'ok') queueMicrotask(() => fn('motif saisi'));
          return chaine;
        },
        onCancel(fn: () => void) {
          if (etat.reponse === 'annuler') queueMicrotask(fn);
          return chaine;
        },
        onDismiss() {
          return chaine;
        },
      };
      return chaine;
    },
    notify: (o: Record<string, unknown>) => etat.notify.push(o),
  }),
}));
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (cle: string, p?: Record<string, unknown>) => (p ? `${cle} ${JSON.stringify(p)}` : cle) }),
}));
vi.mock('../../src/boot/axios', () => ({ api }));

import { useConfirmation } from '../../src/shared/composables/useConfirmation';

function repondre(r: Reponse) {
  etat.reponse = r;
}

beforeEach(() => {
  etat.dialogues = [];
  etat.notify = [];
  api.delete.mockReset();
  repondre('ok');
});

describe('useConfirmation', () => {
  it('confirmer rend vrai sur OK et faux sur Annuler', async () => {
    const { confirmer } = useConfirmation();
    await expect(confirmer({ titre: 'Valider', message: 'Sûr ?' })).resolves.toBe(true);
    repondre('annuler');
    await expect(confirmer({ titre: 'Valider', message: 'Sûr ?' })).resolves.toBe(false);
  });

  it('un bouton destructeur est rouge', async () => {
    const { confirmer } = useConfirmation();
    await confirmer({ titre: 'Supprimer', message: '…', danger: true });
    expect((etat.dialogues[0]!.ok as { color: string }).color).toBe('negative');
  });

  it('couleur, libellé d’annulation et persistance sont transmis', async () => {
    const { confirmer } = useConfirmation();
    await confirmer({ titre: 'Valider', message: '…' });
    await confirmer({ titre: 'Voter', message: '…', couleur: 'positive', libelleAnnuler: 'Revenir', persistent: true });
    await confirmer({ titre: 'Purger', message: '…', couleur: 'positive', danger: true });
    const [defaut, vote, purge] = etat.dialogues as Array<{
      ok: { color: string };
      cancel: { label: string };
      persistent: boolean;
    }>;
    expect(defaut!.ok.color).toBe('primary');
    expect(defaut!.cancel.label).toBe('common.actions.cancel');
    expect(defaut!.persistent).toBe(false);
    expect(vote!.ok.color).toBe('positive');
    expect(vote!.cancel.label).toBe('Revenir');
    expect(vote!.persistent).toBe(true);
    expect(purge!.ok.color).toBe('negative');
  });

  it('confirmerAvecSaisie préremplit le champ avec la valeur initiale', async () => {
    const { confirmerAvecSaisie } = useConfirmation();
    await confirmerAvecSaisie({ titre: 'Imprimer', message: '…', valeurInitiale: 'abc123' });
    await confirmerAvecSaisie({ titre: 'Imprimer', message: '…', valeurInitiale: null });
    expect((etat.dialogues[0]!.prompt as { model: string }).model).toBe('abc123');
    expect((etat.dialogues[1]!.prompt as { model: string }).model).toBe('');
  });

  it('confirmerAvecSaisie rend le texte saisi, ou null si annulé', async () => {
    const { confirmerAvecSaisie } = useConfirmation();
    await expect(confirmerAvecSaisie({ titre: 'Rejeter', message: '…', libelleSaisie: 'Motif' })).resolves.toBe(
      'motif saisi',
    );
    repondre('annuler');
    await expect(confirmerAvecSaisie({ titre: 'Rejeter', message: '…', libelleSaisie: 'Motif' })).resolves.toBeNull();
  });

  it('supprimerAvecConfirmation supprime, notifie puis recharge', async () => {
    api.delete.mockResolvedValue({});
    const recharger = vi.fn();
    const { supprimerAvecConfirmation } = useConfirmation();

    await expect(supprimerAvecConfirmation('/residences/r1', 'Cité A', recharger)).resolves.toBe(true);

    expect(etat.dialogues[0]!.message).toContain('Cité A');
    expect(api.delete).toHaveBeenCalledWith('/residences/r1');
    expect(etat.notify).toEqual([{ type: 'positive', message: 'common.messages.deleted' }]);
    expect(recharger).toHaveBeenCalledOnce();
  });

  it('ne supprime rien si l’utilisateur annule, et ne notifie pas un échec', async () => {
    const recharger = vi.fn();
    const { supprimerAvecConfirmation } = useConfirmation();

    repondre('annuler');
    await expect(supprimerAvecConfirmation('/residences/r1', 'Cité A', recharger)).resolves.toBe(false);
    expect(api.delete).not.toHaveBeenCalled();

    // L'intercepteur axios affiche lui-même le motif d'un DELETE refusé.
    repondre('ok');
    api.delete.mockRejectedValue(new Error('409'));
    await expect(supprimerAvecConfirmation('/residences/r1', 'Cité A', recharger)).resolves.toBe(false);
    expect(etat.notify).toEqual([]);
    expect(recharger).not.toHaveBeenCalled();
  });
});
