import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { supprimer } from '@/shared/services/http';

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
 *
 * Couleur du bouton : `danger` (rouge) pour détruire, sinon `couleur` —
 * 'positive' pour une validation qui engage (feuille de paie, encaissement…),
 * 'warning' pour une étape solennelle (proclamation). Par défaut 'primary'.
 * `persistent` : un clic à côté ne ferme pas (dépôt d'un bulletin de vote…).
 */

export type CouleurConfirmation = 'primary' | 'positive' | 'negative' | 'warning';

export interface OptionsConfirmation {
  titre: string;
  message: string;
  /** Libellé du bouton de validation (par défaut « Confirmer »). */
  ok?: string;
  /** Bouton rouge pour une action destructrice (prime sur `couleur`). */
  danger?: boolean;
  /** Couleur du bouton de validation (par défaut 'primary'). */
  couleur?: CouleurConfirmation;
  /** Libellé du bouton d'annulation (par défaut « Annuler »). */
  libelleAnnuler?: string;
  /** Vrai : un clic hors du dialogue ne le ferme pas. Faux par défaut. */
  persistent?: boolean;
}

export interface OptionsSaisie extends OptionsConfirmation {
  libelleSaisie?: string;
  /** Texte proposé dans le champ à l'ouverture (vide par défaut). */
  valeurInitiale?: string | null | undefined;
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

  function bouton(o: OptionsConfirmation) {
    return {
      label: o.ok ?? t('common.actions.confirm'),
      color: o.danger ? 'negative' : (o.couleur ?? 'primary'),
      unelevated: true,
      noCaps: true,
    };
  }

  function annuler(o: OptionsConfirmation) {
    return { label: o.libelleAnnuler ?? t('common.actions.cancel'), flat: true, noCaps: true };
  }

  function confirmer(o: OptionsConfirmation): Promise<boolean> {
    return new Promise((resolve) => {
      $q.dialog({
        title: o.titre,
        message: o.message,
        cancel: annuler(o),
        ok: bouton(o),
        persistent: o.persistent ?? false,
      })
        .onOk(() => resolve(true))
        .onCancel(() => resolve(false))
        .onDismiss(() => resolve(false));
    });
  }

  /** Variante avec un champ texte libre (motif…) : rend la saisie, ou `null` si annulé. */
  function confirmerAvecSaisie(o: OptionsSaisie): Promise<string | null> {
    return new Promise((resolve) => {
      $q.dialog({
        title: o.titre,
        message: o.message,
        prompt: { model: o.valeurInitiale ?? '', type: 'text', ...(o.libelleSaisie ? { label: o.libelleSaisie } : {}) },
        cancel: annuler(o),
        ok: bouton(o),
        persistent: o.persistent ?? false,
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
      await supprimer(url);
    } catch {
      return false;
    }
    $q.notify({ type: 'positive', message: o.succes ?? t('common.messages.deleted') });
    await recharger?.();
    return true;
  }

  return { confirmer, confirmerAvecSaisie, supprimerAvecConfirmation };
}
