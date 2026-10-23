<template>
  <div class="evaluations-cartes">
    <q-card v-for="e in lignes" :key="e.id" flat bordered class="carte evaluations-cartes__carte">
      <q-card-section>
        <div class="row items-center q-mb-xs">
          <PastilleStatut domaine="evaluation" :statut="e.statut" />
          <q-badge outline color="primary" class="q-ml-sm">
            {{ LIBELLE_TYPE_EVALUATION[e.type] }}
          </q-badge>
          <q-badge outline color="grey-7" class="q-ml-sm">
            {{ $t('evaluations.cards.coefficient', { n: e.coefficient }) }}
          </q-badge>
          <q-space />
          <div class="text-caption text-grey-7">
            {{ dateLisible(e.date) }} · {{ $t('evaluations.cards.semester', { n: e.semestre }) }}
          </div>
        </div>
        <div class="text-subtitle1 text-weight-medium">{{ e.intitule }}</div>
        <div class="text-caption text-grey-7">
          {{ e.matiere?.intitule }} {{ $t('common.format.emptyValue') }} {{ e.promotion?.nom }}
        </div>
        <div class="q-mt-sm">
          <q-badge outline color="primary" :label="libelleNotes(e)" />
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-gutter-xs">
        <q-btn
          v-if="e.statut !== 'OUVERT' || !peutSaisir"
          flat
          dense
          icon="visibility"
          no-caps
          :label="$t('evaluations.cards.notes_view')"
          @click="emit('voir-notes', e)"
        />
        <q-btn
          v-if="e.statut === 'OUVERT' && peutSaisir"
          flat
          dense
          color="primary"
          icon="edit_note"
          no-caps
          :label="$t('evaluations.cards.notes_enter')"
          @click="emit('saisir-notes', e)"
        />
        <actions-secondaires>
          <q-btn
            v-close-popup
            v-if="e.statut === 'OUVERT' && peutGerer"
            flat
            dense
            icon="edit"
            no-caps
            :label="$t('common.actions.edit')"
            @click="emit('modifier', e)"
          />
          <q-btn
            v-close-popup
            v-if="e.statut === 'OUVERT' && peutGerer"
            flat
            dense
            icon="lock"
            no-caps
            :label="$t('common.actions.closeOut')"
            @click="emit('cloturer', e)"
          />
          <q-btn
            v-close-popup
            v-if="peutGerer"
            flat
            dense
            color="negative"
            icon="delete"
            no-caps
            :label="$t('common.actions.delete')"
            :disable="nombreNotes(e) > 0"
            @click="emit('supprimer', e)"
          />
        </actions-secondaires>
      </q-card-actions>
    </q-card>
    <etat-vide v-if="!lignes.length" icone="fact_check" :titre="messageVide">
      <template #action>
        <q-btn
          v-if="filtresActifs"
          outline
          no-caps
          icon="refresh"
          :label="$t('common.actions.reset_filters')"
          @click="emit('reinitialiser')"
        />
        <q-btn
          v-if="peutGerer && !filtresActifs"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('evaluations.actions.new')"
          @click="emit('creer')"
        />
      </template>
    </etat-vide>
  </div>
</template>

<script setup lang="ts">
/**
 * Vue cartes de la liste des évaluations (petit écran) : mêmes actions que la
 * vue tableau, la page reçoit les intentions et les exécute.
 */
import { useI18n } from 'vue-i18n';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { LIBELLE_TYPE_EVALUATION } from '@/shared/utils/libelles';
import { dateLisible } from '@/shared/utils/format';
import type { Evaluation } from '@/types';

defineProps<{
  lignes: Evaluation[];
  messageVide: string;
  filtresActifs: boolean;
  peutGerer: boolean;
  peutSaisir: boolean;
}>();

const emit = defineEmits<{
  'voir-notes': [evaluation: Evaluation];
  'saisir-notes': [evaluation: Evaluation];
  cloturer: [evaluation: Evaluation];
  modifier: [evaluation: Evaluation];
  supprimer: [evaluation: Evaluation];
  creer: [];
  reinitialiser: [];
}>();

const { t } = useI18n();

/** Nombre de notes déjà saisies sur l'évaluation. */
const nombreNotes = (e: Evaluation) => e._count?.notes ?? 0;

const libelleNotes = (e: Evaluation) => {
  const n = nombreNotes(e);
  return t('evaluations.notes_count', { n, plural: n > 1 ? 's' : '' });
};
</script>

<style scoped lang="scss">
.evaluations-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.evaluations-cartes__carte {
  background: var(--up-plaque);
}
</style>
