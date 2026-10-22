import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';

/**
 * Confirmations en une ligne, au lieu d'un `$q.dialog(...).onOk(...)` par page.
 *
 *   const { confirmer, supprimerAvecConfirmation } = useConfirmation();
 *
 *   if (await confirmer({ titre, message, ok: t('…') })) await api.post(…);
 *
 *   // Demande, DELETE, notification de succès, puis rechargement :
 *   await supprimerAvecConfirmation(`/residences/${r.id}`, r.nom, liste.recharger);
 *
 * Les textes par défaut viennent de `common.confirmation` ; le 4e argument de
 * `supprimerAvecConfirmation` permet de garder ceux, plus précis, d'une page.
 * En cas d'échec du DELETE, l'intercepteur axios affiche le motif : on ne
 * notifie ici que le succès.
 */

export interface OptionsConfirmation {
  titre: string;
  message: string;
  /** Libellé du bouton de validation (par défaut « Confirmer »). */
  ok?: string;
  /** Bouton rouge pour une action destructrice. */
  danger?: boolean;
}

export interface OptionsSuppression {
  titre?: string;
  message?: string;
  ok?: string;
  /** Notification de succès (par défaut « Supprimé »). */
  succes?: string;
}

export function useConfirmation() {
  const $q = useQuasar();
  const { t } = useI18n();

  function bouton(o: { ok?: string | undefined; danger?: boolean | undefined }) {
    return {
      label: o.ok ?? t('common.actions.confirm'),
      color: o.danger ? 'negative' : 'primary',
      unelevated: true,
      noCaps: true,
    };
  }

  function confirmer(o: OptionsConfirmation): Promise<boolean> {
    return new Promise((resolve) => {
      $q.dialog({
        title: o.titre,
        message: o.message,
        cancel: { label: t('common.actions.cancel'), flat: true, noCaps: true },
        ok: bouton(o),
        persistent: false,
      })
        .onOk(() => resolve(true))
        .onCancel(() => resolve(false))
        .onDismiss(() => resolve(false));
    });
  }

  /** Variante avec un champ texte libre (motif…) : rend la saisie, ou `null` si annulé. */
  function confirmerAvecSaisie(o: OptionsConfirmation & { libelleSaisie: string }): Promise<string | null> {
    return new Promise((resolve) => {
      $q.dialog({
        title: o.titre,
        message: o.message,
        prompt: { model: '', type: 'text', label: o.libelleSaisie },
        cancel: { label: t('common.actions.cancel'), flat: true, noCaps: true },
        ok: bouton(o),
      })
        .onOk((saisie: string) => resolve(saisie ?? ''))
        .onCancel(() => resolve(null))
        .onDismiss(() => resolve(null));
    });
  }

  async function supprimerAvecConfirmation(
    url: string,
    libelle: string,
    recharger?: () => unknown,
    o: OptionsSuppression = {},
  ): Promise<boolean> {
    const ok = await confirmer({
      titre: o.titre ?? t('common.confirmation.deleteTitle'),
      message: o.message ?? t('common.confirmation.deleteMessage', { libelle }),
      ok: o.ok ?? t('common.actions.yes_delete'),
      danger: true,
    });
    if (!ok) return false;
    try {
      await api.delete(url);
    } catch {
      return false;
    }
    $q.notify({ type: 'positive', message: o.succes ?? t('common.messages.deleted') });
    await recharger?.();
    return true;
  }

  return { confirmer, confirmerAvecSaisie, supprimerAvecConfirmation };
}
