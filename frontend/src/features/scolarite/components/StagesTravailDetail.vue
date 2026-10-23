<template>
  <q-dialog :model-value="!!props.travail" @update:model-value="emit('close')">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="text-h6">{{ $t('stages.detail.title') }}</q-card-section>
      <q-card-section v-if="props.travail">
        <q-list dense>
          <q-item>
            <q-item-section>{{ $t('common.fields.type') }}</q-item-section>
            <q-item-section side>{{ LIBELLE_TYPE_ENCADREMENT[props.travail.type] }}</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <span class="text-weight-medium">{{ props.travail.intitule }}</span>
              <span v-if="props.travail.description" class="text-caption text-grey-7">
                {{ props.travail.description }}
              </span>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>{{ $t('common.fields.student') }}</q-item-section>
            <q-item-section side>
              {{ props.travail.etudiant?.nom }} {{ props.travail.etudiant?.prenom }} ({{
                props.travail.etudiant?.matricule
              }})
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>{{ $t('stages.detail.fields.supervisor') }}</q-item-section>
            <q-item-section side>
              {{
                props.travail.encadrant
                  ? `${props.travail.encadrant.nom} ${props.travail.encadrant.prenom}`
                  : $t('stages.toDesignate')
              }}
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>{{ $t('stages.detail.fields.company') }}</q-item-section>
            <q-item-section side>{{ props.travail.entreprise ?? '—' }}</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>{{ $t('stages.detail.fields.companyTutor') }}</q-item-section>
            <q-item-section side>{{ props.travail.tuteurEntreprise ?? '—' }}</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>{{ $t('stages.detail.fields.place') }}</q-item-section>
            <q-item-section side>{{ props.travail.lieu ?? '—' }}</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>{{ $t('common.fields.period') }}</q-item-section>
            <q-item-section side>
              {{ dateLisible(props.travail.dateDebut) }} → {{ dateLisible(props.travail.dateFin) }}
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>{{ $t('stages.detail.fields.reportSubmitted') }}</q-item-section>
            <q-item-section side>{{
              props.travail.rapportRendu ? $t('stages.detail.yes') : $t('stages.detail.no')
            }}</q-item-section>
          </q-item>
          <q-item v-if="props.travail.soutenance">
            <q-item-section>{{ $t('stages.detail.fields.defense') }}</q-item-section>
            <q-item-section side>
              {{ dateHeureLisible(props.travail.soutenance.date) }}
              <template v-if="props.travail.soutenance.note !== null">
                · {{ props.travail.soutenance.note }}{{ $t('common.units.outOf20') }}
                <template v-if="props.travail.soutenance.mention"> · {{ props.travail.soutenance.mention }}</template>
              </template>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>{{ $t('common.fields.status') }}</q-item-section>
            <q-item-section side>
              <PastilleStatut domaine="stage" :statut="props.travail.statut" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Fiche d'un travail encadré : consultation en lecture seule.
 */
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { LIBELLE_TYPE_ENCADREMENT } from '@/shared/utils/libelles';
import { dateHeureLisible, dateLisible } from '@/shared/utils/format';
import type { TravailEncadre } from '@/types';

const props = defineProps<{
  travail: TravailEncadre | null;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>
