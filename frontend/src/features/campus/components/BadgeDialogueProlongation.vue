<script setup lang="ts">
/**
 * Prolongation d'un badge : une nouvelle date de validité. Le dialogue ne
 * ferme qu'une fois la prolongation acceptée ; en cas d'échec, la saisie reste
 * affichée et l'intercepteur affiche le motif.
 */
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { badgesService } from '../services/badges';
import type { BadgeAcces } from '@/types';

const $q = useQuasar();
const { t } = useI18n();

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  badge?: BadgeAcces | null;
}>();

const emit = defineEmits<{ enregistre: [b: BadgeAcces] }>();

const dateRallonge = ref<string | null>(null);

watch(ouvert, (visible) => {
  if (visible) dateRallonge.value = '';
});

const sousTitre = computed(() =>
  props.badge ? `${props.badge.prenom} ${props.badge.nom} · ${props.badge.numero}` : undefined,
);

async function confirmer() {
  const b = props.badge;
  if (!b || !dateRallonge.value) return;
  try {
    await badgesService.rallonger(b.id, dateRallonge.value);
    $q.notify({ type: 'positive', message: t('badges.messages.extended') });
    ouvert.value = false;
    emit('enregistre', b);
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}
</script>

<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t('badges.dialogs.extend.title')"
    :sous-titre="sousTitre"
    taille="s"
    :libelle-valider="$t('badges.dialogs.extend.confirmAction')"
    :desactive="!dateRallonge"
    @valider="confirmer"
  >
    <q-banner class="note--info q-mb-md">
      {{ $t('badges.dialogs.extend.info') }}
    </q-banner>
    <q-input
      v-model="dateRallonge"
      type="date"
      :label="$t('badges.dialogs.extend.newValidityDateLabel')"
      outlined
      dense
    />
  </dialogue-formulaire>
</template>
