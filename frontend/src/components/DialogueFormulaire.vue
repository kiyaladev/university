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
 * - Convention : à la fin d'un envoi réussi, le dialogue émet `enregistre`
 *   vers son parent puis se ferme.
 */
import { useI18n } from 'vue-i18n';

const ouvert = defineModel<boolean>({ required: true });

withDefaults(
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
  }>(),
  { taille: 'm', envoi: false, couleurValider: 'primary', desactive: false },
);

const emit = defineEmits<{ valider: [] }>();
const { t } = useI18n();
</script>

<template>
  <q-dialog v-model="ouvert">
    <q-card class="dialogue-formulaire" :class="`dialogue-formulaire--${taille}`">
      <q-form greedy @submit="emit('valider')">
        <q-card-section>
          <div class="text-h6">{{ titre }}</div>
          <div v-if="sousTitre" class="text-caption text-grey-7">{{ sousTitre }}</div>
        </q-card-section>

        <q-card-section>
          <slot />
        </q-card-section>

        <q-card-actions align="right">
          <slot name="actions" />
          <q-btn flat :label="t('common.actions.cancel')" v-close-popup />
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
