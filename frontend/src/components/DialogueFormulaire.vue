<script setup lang="ts">
/**
 * Coquille commune des dialogues de saisie : titre, sous-titre, q-form, puis
 * Annuler / Enregistrer. Le dialogue n'écrit que ses champs et son envoi.
 *
 *   <dialogue-formulaire v-model="ouvert" :titre="…" taille="m" :envoi="enregistrement" @valider="enregistrer">
 *     <q-input v-model="form.libelle" :rules="[requis]" … />
 *   </dialogue-formulaire>
 *
 * - `valider` n'est émis que si les `rules` des champs passent (q-form) ;
 *   Entrée dans un champ soumet le formulaire.
 * - `taille` : s (520 px), m (600 px), l (720 px), bornée à 95vw.
 * - `libelleValider`, `iconeValider`, `couleurValider` et `desactive`
 *   règlent le bouton principal ; le slot `actions` ajoute des boutons à gauche.
 * - `libelleAnnuler` remplace « Annuler » ; le bouton est désactivé pendant
 *   `envoi` (une requête partie ne s'annule pas).
 * - Fermeture : `persistent` est VRAI par défaut — un clic à côté ne doit pas
 *   faire perdre une saisie (émission ou révocation d'attestation…). Échap,
 *   geste volontaire, ferme tout de même, sauf pendant `envoi` où le dialogue
 *   est bloqué (Échap et clic à côté le font seulement vibrer). `:persistent="false"`
 *   rend le clic à côté actif, hors envoi.
 * - Après `valider` : un gestionnaire asynchrone (le cas de tous les
 *   formulaires à requête) décide lui-même — convention : à la fin d'un envoi
 *   réussi, il émet `enregistre` vers son parent puis ferme le dialogue ; en
 *   cas d'échec la saisie reste affichée. Un gestionnaire synchrone voit le
 *   dialogue se fermer dès son retour, sauf avec `resterOuvert`.
 */
import { useI18n } from 'vue-i18n';

const ouvert = defineModel<boolean>({ required: true });

const props = withDefaults(
  defineProps<{
    titre: string;
    sousTitre?: string | undefined;
    taille?: 's' | 'm' | 'l';
    /** Requête en cours : bouton principal en chargement. */
    envoi?: boolean;
    libelleValider?: string | undefined;
    iconeValider?: string | undefined;
    couleurValider?: string;
    desactive?: boolean;
    libelleAnnuler?: string | undefined;
    /** Faux : un clic hors du dialogue le ferme (hors envoi). */
    persistent?: boolean;
    /** Ne pas fermer après un `valider` synchrone. */
    resterOuvert?: boolean;
    /**
     * Gestionnaire de `@valider`, déclaré en prop pour savoir s'il est
     * asynchrone (voir plus haut) ; s'écrit `@valider="…"` côté parent.
     */
    onValider?: (() => unknown) | undefined;
  }>(),
  { taille: 'm', envoi: false, couleurValider: 'primary', desactive: false, persistent: true, resterOuvert: false },
);

const { t } = useI18n();

function soumettre() {
  // Entrée pressée pendant l'envoi : pas de second POST.
  if (props.envoi || props.desactive) return;
  const resultat = props.onValider?.();
  if (resultat instanceof Promise) return;
  if (!props.resterOuvert) ouvert.value = false;
}
</script>

<template>
  <q-dialog v-model="ouvert" :persistent="envoi" :no-backdrop-dismiss="persistent">
    <q-card class="dialogue-formulaire" :class="`dialogue-formulaire--${taille}`">
      <q-form greedy @submit="soumettre">
        <q-card-section>
          <div class="text-h6">{{ titre }}</div>
          <div v-if="sousTitre" class="text-caption text-grey-7">{{ sousTitre }}</div>
        </q-card-section>

        <q-card-section>
          <slot />
        </q-card-section>

        <q-card-actions align="right">
          <slot name="actions" />
          <q-btn flat :label="libelleAnnuler ?? t('common.actions.cancel')" :disable="envoi" v-close-popup />
          <q-btn
            type="submit"
            unelevated
            :color="couleurValider"
            :icon="iconeValider"
            :label="libelleValider ?? t('common.actions.save')"
            :loading="envoi"
            :disable="desactive"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.dialogue-formulaire {
  max-width: 95vw;
}
.dialogue-formulaire--s {
  width: 520px;
}
.dialogue-formulaire--m {
  width: 600px;
}
.dialogue-formulaire--l {
  width: 720px;
}
</style>
