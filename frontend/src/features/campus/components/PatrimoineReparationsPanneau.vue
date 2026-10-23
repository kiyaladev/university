<template>
  <q-card flat bordered class="carte">
    <q-card-section>
      <div class="text-subtitle2">{{ $t('patrimoine.repairs.inProgressTitle') }}</div>
      <div class="text-caption text-grey-7">
        {{ $t('patrimoine.repairs.delayCaption') }}
      </div>
    </q-card-section>
    <q-table
      flat
      bordered
      :rows="lignes"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
      :hide-bottom="chargement || lignes.length > 0"
    >
      <template #body-cell-equipement="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.equipement?.libelle ?? '—' }}</div>
          <div class="text-caption text-grey-7">
            {{ p.row.equipement?.numeroInventaire ?? '—' }}
          </div>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-chip
            dense
            :color="p.row.statut === 'EN_COURS' ? 'warning' : 'grey-7'"
            :text-color="p.row.statut === 'EN_COURS' ? 'dark' : 'white'"
          >
            {{ libelleStatutReparation(p.row.statut) }}
          </q-chip>
        </q-td>
      </template>
      <template #body-cell-declarLe="p">
        <q-td :props="p">
          {{ dateLisible(p.row.dateDeclaration) }}
        </q-td>
      </template>
      <template #body-cell-delai="p">
        <q-td :props="p">
          <q-chip
            dense
            :color="couleurDelai(joursEcarts(p.row.dateDeclaration))"
            :text-color="couleurDelai(joursEcarts(p.row.dateDeclaration)) === 'warning' ? 'dark' : 'white'"
          >
            {{ $t('patrimoine.repairs.table.delayDays', { count: joursEcarts(p.row.dateDeclaration) }) }}
          </q-chip>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="peutPlanifier"
            flat
            dense
            round
            color="positive"
            icon="check_circle"
            :aria-label="
              $t('patrimoine.repairs.table.resolveAria', {
                name: p.row.equipement?.libelle ?? $t('patrimoine.repairs.table.fallbackEquipmentName'),
              })
            "
            @click="emit('resoudre', p.row)"
          >
            <q-tooltip>{{ $t('patrimoine.repairs.table.resolveTooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <etat-vide
          icone="build"
          :titre="$t('patrimoine.repairs.emptyState.title')"
          :aide="$t('patrimoine.repairs.emptyState.description')"
        >
          <template #action>
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              icon="inventory_2"
              :label="$t('patrimoine.repairs.emptyState.goToEquipments')"
              @click="emit('voirEquipements')"
            />
          </template>
        </etat-vide>
      </template>
    </q-table>
  </q-card>
</template>

<script setup lang="ts">
/**
 * Onglet « Réparations » du patrimoine : les pièces en attente, les plus
 * anciennes d'abord, et le délai qu'elles cumulent.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import EtatVide from '@/shared/components/EtatVide.vue';
import { dateLisible } from '@/shared/utils/format';
import type { ReparationMateriel, StatutReparation } from '@/types';

defineProps<{
  lignes: ReparationMateriel[];
  chargement: boolean;
  peutPlanifier: boolean;
}>();

const emit = defineEmits<{
  resoudre: [reparation: ReparationMateriel];
  voirEquipements: [];
}>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'equipement', label: t('patrimoine.repairs.table.columns.equipment'), field: 'equipement', align: 'left' },
  { name: 'description', label: t('common.fields.description'), field: 'description', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  {
    name: 'declarLe',
    label: t('patrimoine.repairs.table.columns.declaredOn'),
    field: 'dateDeclaration',
    align: 'left',
  },
  { name: 'delai', label: t('patrimoine.repairs.table.columns.delay'), field: 'delai', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function joursEcarts(date: string): number {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function couleurDelai(j: number): string {
  if (j < 7) return 'positive';
  if (j < 30) return 'warning';
  return 'negative';
}

function libelleStatutReparation(s: StatutReparation): string {
  const cles: Record<string, string> = { DECLARE: 'declared', EN_COURS: 'inProgress', TERMINE: 'done' };
  return t(`patrimoine.repairs.status.${cles[s] ?? 'cancelled'}`);
}
</script>
