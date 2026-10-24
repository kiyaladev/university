<template>
  <div class="row q-col-gutter-md">
    <div v-if="chargement" class="col-12 q-pa-md text-center">
      <q-spinner color="primary" />
    </div>
    <div v-for="f in formations" :key="f.id" class="col-12 col-md-6 col-xl-4">
      <q-card flat bordered class="carte">
        <q-card-section class="row items-center q-pb-none">
          <div class="col">
            <div class="text-uppercase text-caption text-grey-7">{{ f.categorie ?? '—' }}</div>
            <div class="text-subtitle1 text-weight-medium">{{ f.titre }}</div>
          </div>
          <PastilleStatut domaine="formation" :statut="f.statut" />
        </q-card-section>
        <q-card-section class="text-center">
          <div class="text-h3 chiffres">
            {{ montantLisible(f.prix) }} <span class="text-h6">{{ f.devise }}</span>
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">
            <span v-if="f.dureeHeures">{{ $t('common.units.hours', { n: f.dureeHeures }) }}</span>
            <span v-if="f.dateDebut"> · {{ datesLisible(f) }}</span>
          </div>
          <div class="q-mt-md">
            <q-badge :color="placesRestantes(f) > 0 ? 'positive' : 'negative'" :label="placesRestantesStr(f)" />
          </div>
        </q-card-section>
        <q-card-actions class="q-px-md">
          <q-btn
            flat
            dense
            no-caps
            icon="group"
            :label="$t('formationsAdmin.actions.registrations')"
            @click="emit('basculer-registre-carte', f)"
          />
          <q-space />
          <q-btn
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('formationsAdmin.table.aria.edit')"
            @click="emit('modifier', f)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="f.statut === 'BROUILLON'"
            flat
            dense
            round
            color="secondary"
            icon="publish"
            :aria-label="$t('formationsAdmin.table.aria.publish')"
            @click="emit('publier', f)"
          >
            <q-tooltip>{{ $t('common.actions.publish') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="f.statut === 'PUBLIE'"
            flat
            dense
            round
            color="warning"
            icon="lock"
            :aria-label="$t('formationsAdmin.table.aria.close')"
            @click="emit('cloturer', f)"
          >
            <q-tooltip>{{ $t('common.actions.closeOut') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="f.statut === 'BROUILLON'"
            flat
            dense
            round
            color="negative"
            icon="delete_outline"
            :aria-label="$t('formationsAdmin.table.aria.delete')"
            @click="emit('supprimer', f)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
        </q-card-actions>
        <q-slide-transition>
          <div v-if="registreOuvert[f.id]" class="q-px-md q-pb-md">
            <q-separator class="q-mb-sm" />
            <div class="row items-center q-mb-sm">
              <div class="pochoir">{{ $t('formationsAdmin.registry.title', { title: f.titre }) }}</div>
              <q-space />
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                :label="$t('common.actions.reload')"
                icon="refresh"
                @click="emit('recharger-registre', f)"
              />
            </div>
            <formation-registre
              :inscriptions="registres[f.id] ?? []"
              :colonnes="colonnesRegistre"
              :chargement="!!registreCharge[f.id]"
              :afficher-email="false"
              :tout-afficher="true"
              @confirmer="emit('confirmer', $event)"
              @annuler="emit('annuler', $event)"
              @imprimer="emit('imprimer', $event)"
            />
          </div>
        </q-slide-transition>
      </q-card>
    </div>
    <etat-vide
      v-if="!chargement && !formations.length"
      class="col-12"
      icone="workspace_premium"
      :titre="$t('formationsAdmin.emptyState.title')"
      :aide="$t('formationsAdmin.emptyState.description')"
    >
      <template #action>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="add"
          :label="$t('formationsAdmin.actions.newFormation')"
          @click="emit('nouvelle')"
        />
      </template>
    </etat-vide>
  </div>
</template>

<script setup lang="ts">
/**
 * Vue cartes de l'écran d'administration des formations : une fiche par
 * formation, avec son registre des inscriptions dépliable.
 *
 * La page garde la liste et les actions ; ce composant présente les fiches.
 */
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { montantLisible } from '@/shared/utils/format';
import FormationRegistre from './FormationRegistre.vue';
import { datesLisible } from './FormationAffiche';
import type { InscriptionFormationDetail } from '../types';
import type { Formation } from '@/types';

const props = defineProps<{
  formations: Formation[];
  chargement: boolean;
  /** Registre des inscriptions, par formation. */
  registres: Record<string, InscriptionFormationDetail[]>;
  /** Registres en cours de chargement, par formation. */
  registreCharge: Record<string, boolean>;
  /** Registres dépliés, par formation. */
  registreOuvert: Record<string, boolean>;
  /** Colonnes du registre des inscriptions. */
  colonnesRegistre: QTableColumn[];
}>();

const emit = defineEmits<{
  nouvelle: [];
  publier: [formation: Formation];
  cloturer: [formation: Formation];
  modifier: [formation: Formation];
  supprimer: [formation: Formation];
  'basculer-registre-carte': [formation: Formation];
  'recharger-registre': [formation: Formation];
  confirmer: [inscription: InscriptionFormationDetail];
  annuler: [inscription: InscriptionFormationDetail];
  imprimer: [inscription: InscriptionFormationDetail];
}>();

const { t } = useI18n();

/** Places encore disponibles : la capacité moins les inscriptions actives. */
function placesRestantes(f: Formation): number {
  if (!f.capacite) return Number.POSITIVE_INFINITY;
  const occupe =
    (f._count?.inscriptions ?? 0) - (props.registres[f.id]?.filter((r) => r.statut === 'ANNULE').length ?? 0);
  return Math.max(0, f.capacite - occupe);
}

function placesRestantesStr(f: Formation): string {
  if (!f.capacite) return t('formationsAdmin.card.unlimitedSeats');
  return t('formationsAdmin.card.remainingSeats', { count: placesRestantes(f), capacity: f.capacite });
}
</script>
