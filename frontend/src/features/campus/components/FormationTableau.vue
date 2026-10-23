<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="formations"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :rows-per-page-options="[0]"
    :hide-bottom="chargement || formations.length > 0"
  >
    <template #no-data>
      <etat-vide
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
    </template>

    <template #body="p">
      <q-tr :props="p" :class="{ 'ligne-detail': p.expand }">
        <q-td key="titre" :props="p">
          <div class="text-weight-bold">{{ p.row.titre }}</div>
          <div class="text-caption text-grey-7">{{ p.row.categorie ?? '—' }}</div>
        </q-td>
        <q-td key="statut" :props="p" class="text-center">
          <PastilleStatut domaine="formation" :statut="p.row.statut" />
        </q-td>
        <q-td key="prix" :props="p" class="text-right chiffres">
          <span v-if="p.row.prix > 0">{{ montantLisible(p.row.prix) }} {{ p.row.devise }}</span>
          <span v-else class="text-grey-6">{{ $t('formationsAdmin.table.free') }}</span>
        </q-td>
        <q-td key="duree" :props="p" class="text-center chiffres">
          {{ p.row.dureeHeures ? `${p.row.dureeHeures} h` : '—' }}
          <div class="text-caption text-grey-7">{{ datesLisible(p.row) }}</div>
        </q-td>
        <q-td key="capacite" :props="p" class="text-center chiffres">
          {{ p.row.capacite ?? $t('formationsAdmin.table.unlimited') }}
          <span v-if="p.row.capacite" class="text-caption text-grey-7">
            · {{ $t('formationsAdmin.table.requestsCount', { count: p.row._count?.inscriptions ?? 0 }) }}
          </span>
        </q-td>
        <q-td key="inscrits" :props="p" class="text-center chiffres">
          <template v-if="ligneDashboard(p.row.id)">
            <div>{{ ligneDashboard(p.row.id)?.nbInscrits }}</div>
            <div class="text-caption text-grey-7">
              {{ $t('formationsAdmin.table.paidCount', { count: ligneDashboard(p.row.id)?.nbPayes }) }}
            </div>
          </template>
          <span v-else class="text-grey-6">{{ $t('common.format.emptyValue') }}</span>
        </q-td>
        <q-td key="recette" :props="p" class="text-right chiffres">
          <template v-if="ligneDashboard(p.row.id)">
            {{ montantLisible(ligneDashboard(p.row.id)?.recette ?? 0) }}
            <span class="text-caption text-grey-7">{{ p.row.devise }}</span>
          </template>
          <span v-else class="text-grey-6">{{ $t('common.format.emptyValue') }}</span>
        </q-td>
        <q-td key="actions" :props="p" class="text-right">
          <q-btn
            v-if="p.row.statut === 'BROUILLON'"
            flat
            dense
            round
            color="secondary"
            icon="publish"
            :aria-label="$t('formationsAdmin.table.aria.publish')"
            @click="emit('publier', p.row)"
          >
            <q-tooltip>{{ $t('formationsAdmin.table.tooltips.publish') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'PUBLIE'"
            flat
            dense
            round
            color="warning"
            icon="lock"
            :aria-label="$t('formationsAdmin.table.aria.close')"
            @click="emit('cloturer', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.closeOut') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('formationsAdmin.table.aria.edit')"
            @click="emit('modifier', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="group"
            :aria-label="$t('formationsAdmin.table.aria.registrations')"
            @click="basculerRegistre(p)"
          >
            <q-tooltip>{{ $t('formationsAdmin.table.tooltips.registrations') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'BROUILLON'"
            flat
            dense
            round
            color="negative"
            icon="delete_outline"
            :aria-label="$t('formationsAdmin.table.aria.delete')"
            @click="emit('supprimer', p.row)"
          >
            <q-tooltip>{{ $t('formationsAdmin.table.tooltips.delete') }}</q-tooltip>
          </q-btn>
        </q-td>
      </q-tr>

      <tr v-if="p.expand" :key="`${p.row.id}-registre`" class="ligne-detail">
        <td colspan="8" class="q-pa-md">
          <div class="row items-center q-mb-sm">
            <div class="pochoir">{{ $t('formationsAdmin.registry.title', { title: p.row.titre }) }}</div>
            <q-space />
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              :label="$t('common.actions.reload')"
              icon="refresh"
              @click="emit('recharger-registre', p.row)"
            />
          </div>
          <formation-registre
            :inscriptions="registres[p.row.id] ?? []"
            :colonnes="colonnesRegistre"
            :chargement="!!registreCharge[p.row.id]"
            :afficher-email="true"
            :tout-afficher="false"
            @confirmer="emit('confirmer', $event)"
            @annuler="emit('annuler', $event)"
            @imprimer="emit('imprimer', $event)"
          />
        </td>
      </tr>
    </template>
  </q-table>
</template>

<script setup lang="ts">
/**
 * Vue tableau de l'écran d'administration des formations : les formations,
 * leurs chiffres et le registre des inscriptions dépliable.
 *
 * La page garde la liste, les chiffres et les actions ; ce composant présente
 * les lignes et rend les clics.
 */
import type { QTableColumn } from 'quasar';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { montantLisible } from '@/shared/utils/format';
import type { FormationDashboard } from '@/shared/services/formations';
import FormationRegistre from './FormationRegistre.vue';
import { datesLisible } from './FormationAffiche';
import type { InscriptionFormationDetail } from '../types';
import type { Formation } from '@/types';

const props = defineProps<{
  formations: Formation[];
  colonnes: QTableColumn[];
  chargement: boolean;
  /** Chiffres du serveur, pour les colonnes « inscrits » et « recette ». */
  dashboard: FormationDashboard | null;
  /** Registre des inscriptions, par formation. */
  registres: Record<string, InscriptionFormationDetail[]>;
  /** Registres en cours de chargement, par formation. */
  registreCharge: Record<string, boolean>;
  /** Colonnes du registre des inscriptions. */
  colonnesRegistre: QTableColumn[];
}>();

const emit = defineEmits<{
  nouvelle: [];
  publier: [formation: Formation];
  cloturer: [formation: Formation];
  modifier: [formation: Formation];
  supprimer: [formation: Formation];
  'charger-registre': [formation: Formation];
  'recharger-registre': [formation: Formation];
  confirmer: [inscription: InscriptionFormationDetail];
  annuler: [inscription: InscriptionFormationDetail];
  imprimer: [inscription: InscriptionFormationDetail];
}>();

/** Ligne du tableau de bord correspondant à une formation. */
function ligneDashboard(formationId: string) {
  return props.dashboard?.parFormation.find((p) => p.id === formationId);
}

/** Déplie le registre de la ligne et demande son chargement. */
function basculerRegistre(p: { row: Formation; expand: boolean }) {
  p.expand = !p.expand;
  if (p.expand) emit('charger-registre', p.row);
}
</script>
