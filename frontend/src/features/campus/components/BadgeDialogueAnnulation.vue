<script setup lang="ts">
/**
 * Annulation d'un badge : le motif est obligatoire (au moins trois caractères)
 * et part avec la requête. Le dialogue ne ferme qu'une fois l'annulation
 * acceptée ; en cas d'échec, la saisie reste affichée et l'intercepteur
 * affiche le motif.
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

const motif = ref('');

watch(ouvert, (visible) => {
  if (visible) motif.value = '';
});

const sousTitre = computed(() =>
  props.badge ? `${props.badge.prenom} ${props.badge.nom} · ${props.badge.numero}` : undefined,
);

async function confirmer() {
  const b = props.badge;
  if (!b || motif.value.trim().length < 3) return;
  await badgesService.annuler(b.id, motif.value.trim());
  $q.notify({ type: 'warning', message: t('badges.messages.cancelled') });
  ouvert.value = false;
  emit('enregistre', b);
}
</script>

<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t('badges.dialogs.cancel.title')"
    :sous-titre="sousTitre"
    taille="s"
    :libelle-valider="$t('badges.dialogs.cancel.confirmAction')"
    couleur-valider="negative"
    :desactive="motif.trim().length < 3"
    @valider="confirmer"
  >
    <q-banner class="note--alerte q-mb-md">
      {{ $t('badges.dialogs.cancel.warning') }}
    </q-banner>
    <q-input
      v-model="motif"
      :label="$t('badges.dialogs.cancel.reasonLabel')"
      :hint="$t('badges.dialogs.cancel.reasonHint')"
      outlined
      dense
      type="textarea"
      autogrow
    />
  </dialogue-formulaire>
</template>
