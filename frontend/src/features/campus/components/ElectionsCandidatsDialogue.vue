<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="min-width: 640px; max-width: 95vw">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ $t('elections.dialogs.candidates.title', { title: election?.titre }) }}</div>
        <q-space />
        <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" @click="emit('update:modelValue', false)" />
      </q-card-section>
      <q-card-section>
        <q-banner v-if="election?.statut !== 'BROUILLON'" class="note--alerte q-mb-md">
          <template #avatar><q-icon name="lock" /></template>
          {{
            $t('elections.dialogs.candidates.lockedBanner', {
              status: LIBELLE_STATUT_ELECTION[election?.statut ?? 'BROUILLON'].toLowerCase(),
            })
          }}
        </q-banner>

        <etat-vide
          v-if="!candidats.length"
          icone="groups"
          :titre="$t('elections.dialogs.candidates.emptyState')"
        />

        <q-list v-else bordered separator>
          <q-item v-for="c in candidats" :key="c.id">
            <q-item-section avatar>
              <q-avatar>
                <img v-if="c.photoUrl" :src="c.photoUrl" :alt="`${c.prenom} ${c.nom}`" />
                <q-icon v-else name="person" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label
                ><strong>{{ c.prenom }} {{ c.nom }}</strong></q-item-label
              >
              <q-item-label caption>
                {{ $t('elections.dialogs.candidates.ballotNumber', { n: c.ordre }) }}
                <span v-if="c.etudiant">{{
                  $t('elections.dialogs.candidates.studentSuffix', { matricule: c.etudiant.matricule })
                }}</span>
                <span v-if="c.enseignant">{{
                  $t('elections.dialogs.candidates.teacherSuffix', { matricule: c.enseignant.matricule })
                }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section v-if="election?.statut === 'BROUILLON' && peutEditer" side>
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                :aria-label="$t('elections.dialogs.removeCandidate.removeAria', { name: `${c.prenom} ${c.nom}` })"
                @click="emit('supprimerCandidat', c)"
              >
                <q-tooltip>{{ $t('elections.dialogs.candidates.removeTooltip') }}</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps :label="$t('common.actions.close')" @click="emit('update:modelValue', false)" />
        <q-btn
          v-if="election?.statut === 'BROUILLON' && peutEditer"
          unelevated
          color="primary"
          icon="add"
          :label="$t('elections.dialogs.candidates.add')"
          no-caps
          @click="emit('ajouterCandidat')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Liste des candidats d'un scrutin. La page garde la liste ; ce dialogue la
 * présente et rend les actions.
 */
import { LIBELLE_STATUT_ELECTION } from '@/shared/utils/libelles';
import type { CandidatElection, Election } from '@/types';

defineProps<{
  modelValue: boolean;
  election: Election | null;
  candidats: CandidatElection[];
  peutEditer: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [ouvert: boolean];
  supprimerCandidat: [candidat: CandidatElection];
  ajouterCandidat: [];
}>();
</script>
